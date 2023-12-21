using System.Diagnostics;
using OpenTelemetry.Exporter;
using OpenTelemetry.Logs;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddEnvironmentVariables();

// Add services to the container.
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddSingleton<SandboxMiddleware>();

void ConfigureOtlpExporter(OtlpExporterOptions otlpOptions)
{
    otlpOptions.Endpoint = new Uri(builder.Configuration.GetValue<string>("Otlp:Endpoint")!);
    otlpOptions.Headers = $"Api-Key={builder.Configuration.GetValue<string>("Otlp:ApiKey")}";
}

builder.Services.AddLogging(options =>
{
    options.ClearProviders();
    options.AddConsole();
    options.AddOpenTelemetry(loggerOptions =>
    {


        loggerOptions
            // define the resource
            //.SetResourceBuilder(resourceBuilder)
            // add custom processor
            //.AddProcessor(new CustomLogProcessor())
            // send logs to the console using exporter
            .SetResourceBuilder(ResourceBuilder.CreateDefault().AddService("api", typeof(Program).Namespace, (typeof(Program).Assembly?.GetName().Version ?? new Version(0, 1, 0)).ToString()))
            .AddOtlpExporter(ConfigureOtlpExporter)
            .AddConsoleExporter()
            ;

        loggerOptions.IncludeFormattedMessage = true;
        loggerOptions.IncludeScopes = true;
        loggerOptions.ParseStateValues = true;
        
    });
});

builder.Services.AddOpenTelemetry()
    .WithMetrics(meterProviderBuilder => meterProviderBuilder
        .SetResourceBuilder(ResourceBuilder.CreateDefault().AddService("api", typeof(Program).Namespace, (typeof(Program).Assembly?.GetName().Version ?? new Version(0, 1, 0)).ToString()))
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddRuntimeInstrumentation()
        .AddOtlpExporter(ConfigureOtlpExporter))
    .WithTracing(tracerProviderBuilder => tracerProviderBuilder
        .SetResourceBuilder(ResourceBuilder.CreateDefault().AddService("api", typeof(Program).Namespace, (typeof(Program).Assembly?.GetName().Version ?? new Version(0, 1, 0)).ToString()))
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddOtlpExporter(ConfigureOtlpExporter)
        .AddConsoleExporter());

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};


app.UseMiddleware<SandboxMiddleware>();

app.MapGet("/weatherforecast", (ILogger<Program> logger) =>
    {
        using var activity = Activity.Current?.Source.StartActivity("BL/Weather+Log", ActivityKind.Server);

        activity.AddSandboxTag();

        logger.LogInformation("Got the weather");

        var forecast =  Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast")
.WithOpenApi();

app.Run();