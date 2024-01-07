using System;
using System.Diagnostics;
using System.Net;
using Example.Api.Sandbox.Temporary;
using Microsoft.AspNetCore.Diagnostics;

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


builder.Services.AddSpaStaticFiles(configuration =>
{
    configuration.RootPath = "wwwroot";
});

builder.ConfigureOpenTelemetry();

RegisterResources(builder);

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
    app.UseSpaStaticFiles();
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


app.MapGet("/failure/{resource}/status", async (string resource, ILogger<Program> logger, ISandboxCircuitBreaker cb, CancellationToken cancellationToken) => new JsonResult(await cb.IsOpenAsync(resource)))
    .WithName("FailureStatus")
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

app.MapPost("/flow/execute/sql", async (ILogger<Program> logger, ISandboxCircuitBreaker cb, IConfiguration configuration, SqlConnection connection, CancellationToken cancellationToken) =>
    {
        //circuit is open, break the functionality
        var isOpen = await cb.IsSqlOpenAsync(cancellationToken);

        if (isOpen)
        {
            throw new MockSqlException("Failure injected. Sql circuit is open.");
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
    .WithName("ExecuteSql")
    .WithOpenApi();


app.MapPost("/flow/execute/redis", async (ILogger<Program> logger, ISandboxCircuitBreaker cb, IConfiguration configuration, IConnectionMultiplexer mux, CancellationToken cancellationToken) =>
    {
        //circuit is open, break the functionality
        var isOpen = await cb.IsRedisOpenAsync(cancellationToken);

        if (isOpen)
        {
            throw new MockRedisException("Failure injected. Redis circuit is open.");
        }

        //intentionally not disposed as to not to kill the mux
        var cache = new RedisCache(new OptionsWrapper<RedisCacheOptions>(new RedisCacheOptions()
            { ConnectionMultiplexerFactory = async () => mux
            }));

        var key = Guid.NewGuid().ToString();
        await cache.SetAsync(key, Array.Empty<byte>(), new DistributedCacheEntryOptions(), cancellationToken);

        await cache.RemoveAsync(key, cancellationToken);

        logger.LogInformation("Got Redis");

        var result = new Dictionary<string, object>();

        result.Add("Added", DateTime.UtcNow);
        result.Add("Removed", DateTime.UtcNow);

        logger.LogInformation("Got Redis");

        return new JsonResult(result);
    })
    .WithName("ExecuteRedis")
    .WithOpenApi();

app.UseSpa(spa =>
{
    if (builder.Environment.IsDevelopment())
    {
        // Make sure you have started the frontend with npm run dev on port 4000
        //spa.UseProxyToSpaDevelopmentServer("http://localhost:4000");
    }
});


app.Run();

void RegisterResources(WebApplicationBuilder webApplicationBuilder)
{
    webApplicationBuilder.Services.AddScoped<SqlConnection>(provider =>
    {
        var connectionString = webApplicationBuilder.Configuration.GetValue<string>("ConnectionStrings:Sql:Closed")!;

        return new SqlConnection(connectionString);
    });


    webApplicationBuilder.Services.AddSingleton<IConnectionMultiplexer>(provider =>
    {
        var connectionString = webApplicationBuilder.Configuration.GetValue<string>("ConnectionStrings:Redis:Closed")!;

        return ConnectionMultiplexer.Connect(connectionString, options => { });
    });
}