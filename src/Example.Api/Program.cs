using System.Diagnostics;
using System.Net;
using Microsoft.AspNetCore.Diagnostics;
using Polly;
using static System.Net.Mime.MediaTypeNames;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddEnvironmentVariables();

builder.Services.AddCors();

// Add services to the container.
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddSingleton<SandboxMiddleware>();

builder.Services.AddHttpContextAccessor();
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSingleton<ISandboxCircuitBreaker, SandboxCircuitBreaker>();


RegisterResources(builder);


ConfigureOpenTelemetry(builder);

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();

    app.UseCors(options =>
    {
        options.AllowAnyOrigin();
        options.AllowAnyMethod();
        options.AllowAnyHeader();

    });
}
else
{
    app.UseStaticFiles();
}

app.UseHttpsRedirection();

app.UseMiddleware<SandboxMiddleware>();
app.UseExceptionHandler(options =>
{
    options.Use((context, next) =>
    {
        context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
        context.Response.ContentType = "text/html";

        var ex = context.Features.Get<IExceptionHandlerFeature>();

        if (ex != null)
        {

            Activity.Current?.RecordException(ex.Error);
        }

        return next(context);
    });
});

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", (ILogger<Program> logger, CancellationToken cancellationToken) =>
    {
        var forecast = Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();

        logger.LogInformation("Got the weather");
        return forecast;
    })
.WithName("GetWeatherForecast")
.WithOpenApi();


app.MapPost("/sandbox", (ILogger<Program> logger, CancellationToken cancellationToken) => new JsonResult(Guid.NewGuid().ToString("N")))
    .WithName("GetSandbox")
    .WithOpenApi();

app.MapPost("/failure/{resource}/inject", async (string resource, ILogger<Program> logger, ISandboxCircuitBreaker cb, CancellationToken cancellationToken) =>
    {
        await cb.OpenAsync(resource);
        return new JsonResult(true);
    })
    .WithName("InjectFailure")
    .WithOpenApi();

app.MapPost("/failure/{resource}/eject", async (string resource, ILogger<Program> logger, ISandboxCircuitBreaker cb, CancellationToken cancellationToken) =>
    {
        await cb.CloseAsync(resource);
        return new JsonResult(true);
    })
    .WithName("EjectFailure")
    .WithOpenApi();

app.MapPost("/flow/execute/sql", async (ILogger<Program> logger, ISandboxCircuitBreaker cb, SqlConnection connection, CancellationToken cancellationToken) =>
    {
        //circuit is open, break the functionality
        var isOpen = await cb.IsSqlOpenAsync(cancellationToken);

        if (isOpen)
        {
            connection = new SqlConnection("invalid");
        }

        var command = new SqlCommand("SELECT NEWID() as ID, GETUTCDATE() as [DateNowUtc]", connection);
        command.Connection.Open();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        var result = new Dictionary<string, object>();

        while (await reader.ReadAsync(cancellationToken))
        {
            result.Add("ID", reader.GetValue(0));
            result.Add("DateNowUtc", reader.GetValue(1));
        }

        logger.LogInformation("Got Sql");

        return new JsonResult(result);

    })
    .WithName("TestSql")
    .WithOpenApi();


app.MapPost("/flow/execute/redis", async (ILogger<Program> logger, ISandboxCircuitBreaker cb, IConnectionMultiplexer mux, CancellationToken cancellationToken) =>
    {
        //circuit is open, break the functionality
        var isOpen = await cb.IsRedisOpenAsync(cancellationToken);

        //intentionally not disposed as to not to kill the mux
        var cache = new RedisCache(new OptionsWrapper<RedisCacheOptions>(new RedisCacheOptions()
            { ConnectionMultiplexerFactory = () => isOpen ? new Task<IConnectionMultiplexer>(null) : Task.FromResult(mux)
            }));

        var key = Guid.NewGuid().ToString();
        await cache.SetAsync(key, Array.Empty<byte>(), new DistributedCacheEntryOptions(), cancellationToken);

        await cache.RemoveAsync(key, cancellationToken);

        logger.LogInformation("Got Redis");
        
        return new JsonResult(true);
    })
    .WithName("TestRedis")
    .WithOpenApi();

app.Run();

void ConfigureOpenTelemetry(WebApplicationBuilder webApplicationBuilder)
{
    var resourceBuilder = ResourceBuilder.CreateDefault().AddService("api", typeof(Program).Namespace,
        (typeof(Program).Assembly?.GetName().Version ?? new Version(0, 1, 0)).ToString());

    void ConfigureExporter(OtlpExporterOptions otlpOptions)
    {
        otlpOptions.Endpoint = new Uri(webApplicationBuilder.Configuration.GetValue<string>("Otlp:Endpoint")!);
        otlpOptions.Headers = $"Api-Key={webApplicationBuilder.Configuration.GetValue<string>("Otlp:ApiKey")}";
    }

    webApplicationBuilder.Services.AddLogging(options =>
    {
        options.ClearProviders();
        options.AddConsole();
        options.AddOpenTelemetry(loggerOptions =>
        {
            loggerOptions
                .SetResourceBuilder(resourceBuilder)
                .AddOtlpExporter(ConfigureExporter)
                .AddConsoleExporter()
                ;

            loggerOptions.IncludeFormattedMessage = true;
            loggerOptions.IncludeScopes = true;
            loggerOptions.ParseStateValues = true;
        });
    });

    webApplicationBuilder.Services.AddOpenTelemetry()
        .WithMetrics(meterProviderBuilder => meterProviderBuilder
            .SetResourceBuilder(resourceBuilder)
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
            .AddRuntimeInstrumentation()
            .AddProcessInstrumentation()
            .AddOtlpExporter(ConfigureExporter))
        .WithTracing(tracerProviderBuilder => tracerProviderBuilder
            .SetResourceBuilder(resourceBuilder)
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
            .AddSqlClientInstrumentation(options =>
            {
                options.RecordException = true;
                options.SetDbStatementForText = true;
                options.SetDbStatementForStoredProcedure = true;
            })
            .AddRedisInstrumentation()
            .AddOtlpExporter(ConfigureExporter)
            .AddConsoleExporter());
}

void RegisterResources(WebApplicationBuilder webApplicationBuilder)
{
    webApplicationBuilder.Services.AddScoped<SqlConnection>(provider =>
    {
        var connectionString = webApplicationBuilder.Configuration.GetValue<string>("ConnectionStrings:Sql")!;

        return new SqlConnection(connectionString);
    });


    webApplicationBuilder.Services.AddSingleton<IConnectionMultiplexer>(provider =>
    {
        var connectionString = webApplicationBuilder.Configuration.GetValue<string>("ConnectionStrings:Redis")!;

        return ConnectionMultiplexer.Connect(connectionString, options => { });
    });
}
