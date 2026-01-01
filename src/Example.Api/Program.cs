using System;
using System.Diagnostics;
using System.Net;
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

app.MapPost("/flow/execute/sql", async (HttpRequest request, ILogger<Program> logger, ISandboxCircuitBreaker cb, IConfiguration configuration, SqlConnection connection, CancellationToken cancellationToken) =>
    {
        try
        {
            // Get scenario from query string (defaults to "success")
            var scenario = request.Query["scenario"].FirstOrDefault() ?? "success";

            // Map scenario to safe, hardcoded queries - NO user input in SQL
            var query = scenario.ToLowerInvariant() switch
            {
                "wrong-table" => "SELECT NEWID() as ID FROM NonExistentTable_12345",
                "wrong-column" => "SELECT NonExistentColumn_XYZ FROM sys.tables",
                "syntax-error" => "SELECT * FROM @InvalidSyntax!!!",
                "division-error" => "SELECT 1/0 as Result",
                _ => "SELECT NEWID() as ID, GETUTCDATE() as [DateNowUtc]"  // success/default
            };

            logger.LogInformation("Sandbox >>> Executing SQL scenario: {Scenario}", scenario);

            //circuit is open, break the functionality
            var isOpen = await cb.IsSqlOpenAsync(cancellationToken);

            if (isOpen)
            {
                logger.LogWarning("Sandbox >>> SQL circuit is open. Operation will fail");
                var connectionString = configuration.GetValue<string>("ConnectionStrings:Sql:Open");
                connection = new SqlConnection(connectionString + ";Connect Timeout=1");
            }

            var command = new SqlCommand(query, connection);
            command.Connection.Open();
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            var result = new Dictionary<string, object>();

            while (await reader.ReadAsync(cancellationToken))
            {
                for (int i = 0; i < reader.FieldCount; i++)
                {
                    result[reader.GetName(i)] = reader.GetValue(i);
                }
            }

            logger.LogInformation("Sandbox >>> SQL scenario '{Scenario}' succeeded", scenario);

            return new JsonResult(result);

        }
        catch (Exception e)
        {
            logger.LogError(e, "Sandbox >>> SQL operation failed");
            throw;
        }



    })
    .WithName("ExecuteSql")
    .WithOpenApi();


app.MapPost("/flow/execute/pipeline", async (HttpRequest request, ILogger<Program> logger, ISandboxCircuitBreaker cb, IConfiguration configuration, SqlConnection connection, IConnectionMultiplexer mux, CancellationToken cancellationToken) =>
    {
        var pipelineId = Guid.NewGuid().ToString("N")[..8];
        var scenario = request.Query["scenario"].FirstOrDefault() ?? "simple-saga";

        using var pipelineActivity = SandboxSources.DefaultActivitySource.StartActivity("Pipeline.Execute", ActivityKind.Internal);
        pipelineActivity?.SetTag("pipeline.id", pipelineId);
        pipelineActivity?.SetTag("pipeline.scenario", scenario);
        pipelineActivity?.SetTag("pipeline.type", "chaos-simulation");

        logger.LogInformation("Pipeline {PipelineId} >>> Starting chaos simulation pipeline", pipelineId);

        var results = new Dictionary<string, object>
        {
            ["pipelineId"] = pipelineId,
            ["startedAt"] = DateTime.UtcNow
        };

        try
        {
            // === STAGE 1: Validation ===
            using (var validationActivity = SandboxSources.DefaultActivitySource.StartActivity("Pipeline.Validate", ActivityKind.Internal))
            {
                validationActivity?.SetTag("stage", "validation");
                logger.LogInformation("Pipeline {PipelineId} >>> Stage 1: Validating request parameters", pipelineId);

                await Task.Delay(50, cancellationToken); // Simulate validation work

                var validationChecks = new[] { "schema", "permissions", "quota", "rate-limit" };
                foreach (var check in validationChecks)
                {
                    using var checkActivity = SandboxSources.DefaultActivitySource.StartActivity($"Validate.{check}", ActivityKind.Internal);
                    checkActivity?.SetTag("check.name", check);
                    await Task.Delay(20, cancellationToken);
                    checkActivity?.SetTag("check.passed", true);
                    logger.LogDebug("Pipeline {PipelineId} >>> Validation check '{Check}' passed", pipelineId, check);
                }

                validationActivity?.SetTag("validation.passed", true);
                results["validationPassed"] = true;
            }

            // === STAGE 2: Data Fetch (Parallel SQL + Redis) ===
            using (var fetchActivity = SandboxSources.DefaultActivitySource.StartActivity("Pipeline.FetchData", ActivityKind.Internal))
            {
                fetchActivity?.SetTag("stage", "data-fetch");
                logger.LogInformation("Pipeline {PipelineId} >>> Stage 2: Fetching data from SQL and Redis in parallel", pipelineId);

                var sqlTask = Task.Run(async () =>
                {
                    using var sqlActivity = SandboxSources.DefaultActivitySource.StartActivity("FetchData.SQL", ActivityKind.Client);
                    sqlActivity?.SetTag("db.system", "mssql");

                    for (int i = 1; i <= 3; i++)
                    {
                        using var queryActivity = SandboxSources.DefaultActivitySource.StartActivity($"SQL.Query.{i}", ActivityKind.Client);
                        queryActivity?.SetTag("db.operation", "SELECT");
                        queryActivity?.SetTag("db.query.index", i);

                        var query = "SELECT NEWID() as ID, GETUTCDATE() as [Timestamp]";
                        var command = new SqlCommand(query, connection);

                        if (connection.State != System.Data.ConnectionState.Open)
                            command.Connection.Open();

                        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
                        while (await reader.ReadAsync(cancellationToken)) { }

                        logger.LogDebug("Pipeline {PipelineId} >>> SQL query {Index} completed", pipelineId, i);
                    }

                    return "sql-complete";
                }, cancellationToken);

                var redisTask = Task.Run(async () =>
                {
                    using var redisActivity = SandboxSources.DefaultActivitySource.StartActivity("FetchData.Redis", ActivityKind.Client);
                    redisActivity?.SetTag("db.system", "redis");

                    var cache = new RedisCache(new OptionsWrapper<RedisCacheOptions>(new RedisCacheOptions()
                    {
                        ConnectionMultiplexerFactory = async () => mux
                    }));

                    for (int i = 1; i <= 4; i++)
                    {
                        using var cacheActivity = SandboxSources.DefaultActivitySource.StartActivity($"Redis.Operation.{i}", ActivityKind.Client);
                        cacheActivity?.SetTag("db.operation", i % 2 == 0 ? "GET" : "SET");
                        cacheActivity?.SetTag("cache.key.index", i);

                        var key = $"pipeline:{pipelineId}:key{i}";
                        if (i % 2 == 0)
                        {
                            await cache.GetAsync(key, cancellationToken);
                        }
                        else
                        {
                            await cache.SetAsync(key, new byte[] { (byte)i }, new DistributedCacheEntryOptions
                            {
                                AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(30)
                            }, cancellationToken);
                        }

                        logger.LogDebug("Pipeline {PipelineId} >>> Redis operation {Index} completed", pipelineId, i);
                    }

                    return "redis-complete";
                }, cancellationToken);

                await Task.WhenAll(sqlTask, redisTask);
                fetchActivity?.SetTag("fetch.sql.status", await sqlTask);
                fetchActivity?.SetTag("fetch.redis.status", await redisTask);
                results["dataFetchCompleted"] = true;
            }

            // === STAGE 3: Processing with Retry Logic ===
            using (var processActivity = SandboxSources.DefaultActivitySource.StartActivity("Pipeline.Process", ActivityKind.Internal))
            {
                processActivity?.SetTag("stage", "processing");
                logger.LogInformation("Pipeline {PipelineId} >>> Stage 3: Processing data with retry logic", pipelineId);

                var maxRetries = 3;
                var attempt = 0;
                var shouldSimulateFailure = Random.Shared.Next(100) < 40; // 40% chance of needing retries

                while (attempt < maxRetries)
                {
                    attempt++;
                    using var attemptActivity = SandboxSources.DefaultActivitySource.StartActivity($"Process.Attempt.{attempt}", ActivityKind.Internal);
                    attemptActivity?.SetTag("retry.attempt", attempt);
                    attemptActivity?.SetTag("retry.max", maxRetries);

                    logger.LogInformation("Pipeline {PipelineId} >>> Processing attempt {Attempt}/{MaxRetries}", pipelineId, attempt, maxRetries);

                    // Simulate processing work
                    using (var transformActivity = SandboxSources.DefaultActivitySource.StartActivity("Transform.Data", ActivityKind.Internal))
                    {
                        transformActivity?.SetTag("transform.type", "aggregation");
                        await Task.Delay(100, cancellationToken);
                    }

                    using (var enrichActivity = SandboxSources.DefaultActivitySource.StartActivity("Enrich.Metadata", ActivityKind.Internal))
                    {
                        enrichActivity?.SetTag("enrich.fields", "timestamp,source,correlation");
                        await Task.Delay(50, cancellationToken);
                    }

                    // Simulate transient failure on first attempts
                    if (shouldSimulateFailure && attempt < maxRetries)
                    {
                        var backoffMs = (int)Math.Pow(2, attempt) * 100;
                        attemptActivity?.SetStatus(ActivityStatusCode.Error, "Transient failure - retrying");
                        logger.LogWarning("Pipeline {PipelineId} >>> Transient failure on attempt {Attempt}, backing off {BackoffMs}ms", pipelineId, attempt, backoffMs);

                        using var backoffActivity = SandboxSources.DefaultActivitySource.StartActivity("Retry.Backoff", ActivityKind.Internal);
                        backoffActivity?.SetTag("backoff.ms", backoffMs);
                        backoffActivity?.SetTag("backoff.strategy", "exponential");
                        await Task.Delay(backoffMs, cancellationToken);

                        shouldSimulateFailure = Random.Shared.Next(100) < 20; // Reduce failure chance
                        continue;
                    }

                    attemptActivity?.SetStatus(ActivityStatusCode.Ok);
                    logger.LogInformation("Pipeline {PipelineId} >>> Processing succeeded on attempt {Attempt}", pipelineId, attempt);
                    break;
                }

                processActivity?.SetTag("process.final_attempt", attempt);
                processActivity?.SetTag("process.retried", attempt > 1);
                results["processingAttempts"] = attempt;
            }

            // === STAGE 4: Distributed Transaction Simulation (Saga Pattern) ===
            // Simulates distributed microservices:
            // - order-service: Handles order creation and management
            // - inventory-service: Manages stock levels and reservations
            // - payment-service: Processes payment transactions
            // - notification-service: Sends order confirmations and alerts
            using (var txActivity = SandboxSources.DefaultActivitySource.StartActivity("Pipeline.DistributedTx", ActivityKind.Internal))
            {
                txActivity?.SetTag("stage", "distributed-transaction-simulation");
                txActivity?.SetTag("tx.type", "saga");
                txActivity?.SetTag("saga.scenario", scenario);
                logger.LogInformation("Pipeline {PipelineId} >>> Stage 4: Simulating distributed transaction (saga pattern) - Scenario: {Scenario}", pipelineId, scenario);

                // Build service instances based on scenario
                // simple-saga: 4 services with 1 instance each
                // multi-replica-saga: 4 services with 2 instances each (simulates load-balanced replicas)
                var serviceInstances = scenario == "multi-replica-saga"
                    ? new[]
                    {
                        ("order-service", "order-001"),
                        ("order-service", "order-002"),
                        ("inventory-service", "inventory-001"),
                        ("inventory-service", "inventory-002"),
                        ("payment-service", "payment-001"),
                        ("payment-service", "payment-002"),
                        ("notification-service", "notification-001"),
                        ("notification-service", "notification-002")
                    }
                    : new[]
                    {
                        ("order-service", "order-001"),
                        ("inventory-service", "inventory-001"),
                        ("payment-service", "payment-001"),
                        ("notification-service", "notification-001")
                    };

                var completedServices = new List<string>();

                foreach (var (service, instanceId) in serviceInstances)
                {
                    using var serviceActivity = SandboxSources.DefaultActivitySource.StartActivity($"Saga.{service}", ActivityKind.Client);
                    serviceActivity?.SetTag("service.name", service);
                    serviceActivity?.SetTag("service.version", "1.0.0.0");
                    serviceActivity?.SetTag("service.instance.id", instanceId);
                    serviceActivity?.SetTag("saga.service", service);
                    serviceActivity?.SetTag("saga.operation", "commit");

                    logger.LogDebug("Pipeline {PipelineId} >>> Saga: Committing {Service} ({InstanceId})", pipelineId, service, instanceId);
                    await Task.Delay(75, cancellationToken);

                    serviceActivity?.SetTag("saga.committed", true);
                    completedServices.Add($"{service}:{instanceId}");
                }

                txActivity?.SetTag("tx.services_committed", string.Join(",", completedServices));
                txActivity?.SetTag("tx.replica_count", scenario == "multi-replica-saga" ? 2 : 1);
                results["sagaServicesCommitted"] = completedServices.Count;
                results["sagaScenario"] = scenario;
            }

            // === STAGE 5: Finalization ===
            using (var finalActivity = SandboxSources.DefaultActivitySource.StartActivity("Pipeline.Finalize", ActivityKind.Internal))
            {
                finalActivity?.SetTag("stage", "finalization");
                logger.LogInformation("Pipeline {PipelineId} >>> Stage 5: Finalizing pipeline", pipelineId);

                using (var cleanupActivity = SandboxSources.DefaultActivitySource.StartActivity("Cleanup.TempData", ActivityKind.Internal))
                {
                    await Task.Delay(30, cancellationToken);
                }

                using (var auditActivity = SandboxSources.DefaultActivitySource.StartActivity("Audit.LogCompletion", ActivityKind.Internal))
                {
                    auditActivity?.SetTag("audit.event", "pipeline_completed");
                    await Task.Delay(20, cancellationToken);
                }

                using (var metricsActivity = SandboxSources.DefaultActivitySource.StartActivity("Metrics.Record", ActivityKind.Internal))
                {
                    metricsActivity?.SetTag("metrics.type", "pipeline_duration");
                    await Task.Delay(10, cancellationToken);
                }
            }

            results["completedAt"] = DateTime.UtcNow;
            results["status"] = "success";

            pipelineActivity?.SetStatus(ActivityStatusCode.Ok);
            logger.LogInformation("Pipeline {PipelineId} >>> Chaos simulation pipeline completed successfully", pipelineId);

            return new JsonResult(results);
        }
        catch (Exception e)
        {
            pipelineActivity?.SetStatus(ActivityStatusCode.Error, e.Message);
            pipelineActivity?.RecordException(e);
            logger.LogError(e, "Pipeline {PipelineId} >>> Pipeline execution failed", pipelineId);
            throw;
        }
    })
    .WithName("ExecutePipeline")
    .WithOpenApi();


app.MapPost("/flow/execute/redis", async (HttpRequest request, ILogger<Program> logger, ISandboxCircuitBreaker cb, IConfiguration configuration, IConnectionMultiplexer mux, CancellationToken cancellationToken) =>
    {
        try
        {
            // Get scenario from query string (defaults to "success")
            var scenario = request.Query["scenario"].FirstOrDefault() ?? "success";

            logger.LogInformation("Sandbox >>> Executing Redis scenario: {Scenario}", scenario);

            //circuit is open, break the functionality
            var isOpen = await cb.IsRedisOpenAsync(cancellationToken);

            if (isOpen)
            {
                logger.LogWarning("Sandbox >>> Redis circuit is open. Operation will fail");
            }

            //intentionally not disposed as to not to kill the mux
            var cache = new RedisCache(new OptionsWrapper<RedisCacheOptions>(new RedisCacheOptions()
            {
                ConnectionMultiplexerFactory = async () =>
                {
                    if (isOpen)
                    {
                        var connectionString = configuration.GetValue<string>("ConnectionStrings:Redis:Open");

                        //synctimeout=1000 is for Azure Redis
                        return ConnectionMultiplexer.Connect(connectionString + ",connectTimeout=1000,synctimeout=1000");
                    }

                    return mux;
                }
            }));

            var key = Guid.NewGuid().ToString();

            // Handle different Redis scenarios
            switch (scenario.ToLowerInvariant())
            {
                case "missing-key":
                    // Try to get a key that doesn't exist
                    var missingValue = await cache.GetAsync("nonexistent-key-" + Guid.NewGuid().ToString(), cancellationToken);
                    return new JsonResult(new { Key = "nonexistent", Value = missingValue == null ? "null" : "found", Scenario = "missing-key" });

                case "large-value":
                    // Store a larger value to simulate memory pressure
                    var largeData = new byte[1024 * 10]; // 10KB
                    Random.Shared.NextBytes(largeData);
                    await cache.SetAsync(key, largeData, new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(5) }, cancellationToken);
                    await cache.RemoveAsync(key, cancellationToken);
                    return new JsonResult(new { Key = key, Size = largeData.Length, Scenario = "large-value" });

                case "expired-key":
                    // Set a key with immediate expiration
                    await cache.SetAsync(key, new byte[] { 1, 2, 3 }, new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromMilliseconds(1) }, cancellationToken);
                    await Task.Delay(10, cancellationToken); // Wait for expiration
                    var expiredValue = await cache.GetAsync(key, cancellationToken);
                    return new JsonResult(new { Key = key, Expired = expiredValue == null, Scenario = "expired-key" });

                case "serialization-error":
                    // Intentionally throw a serialization-like error
                    throw new InvalidOperationException("Serialization error: Failed to deserialize cached object - corrupt data detected");

                case "invalid-operation":
                    // Intentionally throw an invalid operation error (simulating wrong data type)
                    throw new InvalidOperationException("Invalid operation: WRONGTYPE Operation against a key holding the wrong kind of value");

                default: // "success"
                    await cache.SetAsync(key, Array.Empty<byte>(), new DistributedCacheEntryOptions(), cancellationToken);
                    await cache.RemoveAsync(key, cancellationToken);
                    break;
            }

            logger.LogInformation("Sandbox >>> Redis scenario '{Scenario}' succeeded", scenario);

            var result = new Dictionary<string, object>();
            result.Add("Added", DateTime.UtcNow);
            result.Add("Removed", DateTime.UtcNow);
            result.Add("Scenario", scenario);

            return new JsonResult(result);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Sandbox >>> Redis operation failed");
            throw;
        }
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
