public static class SandboxExtensions
{
    public static void ConfigureOpenTelemetry(this WebApplicationBuilder webApplicationBuilder)
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
                .AddSource(SandboxSources.DefaultActivitySource.Name)
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
}