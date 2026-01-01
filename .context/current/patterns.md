# Design Patterns and Practices

## 1. Circuit Breaker Pattern

The application implements a simplified circuit breaker for failure simulation:

```csharp
public interface ISandboxCircuitBreaker
{
    Task<bool> IsOpenAsync(string resource, string sandboxId);
    Task OpenAsync(string resource, string sandboxId);
    Task CloseAsync(string resource, string sandboxId);
}
```

**Implementation Details:**
- Uses `IDistributedCache` for state storage
- Cache key format: `{sandboxId}/{resource}`
- Open circuit → uses invalid connection string → causes timeout
- Closed circuit → uses valid connection string → normal operation

## 2. Sandbox Isolation Pattern

Each user operates in an isolated sandbox:

```csharp
public class SandboxMiddleware
{
    public async Task InvokeAsync(HttpContext context)
    {
        var sandboxId = context.Request.GetSandboxId();
        if (!string.IsNullOrEmpty(sandboxId))
        {
            Baggage.SetBaggage("sandbox.id", sandboxId);
            Activity.Current?.SetTag("sandbox.id", sandboxId);
        }
        await _next(context);
    }
}
```

**Benefits:**
- Multi-user concurrent testing
- No interference between experiments
- Easy telemetry filtering by sandbox

## 3. OpenTelemetry Three Pillars

### Traces
```csharp
services.AddOpenTelemetry()
    .WithTracing(builder => builder
        .AddAspNetCoreInstrumentation()
        .AddHttpClientInstrumentation()
        .AddSqlClientInstrumentation(o => o.RecordException = true)
        .AddRedisInstrumentation()
        .AddOtlpExporter());
```

### Metrics
```csharp
.WithMetrics(builder => builder
    .AddAspNetCoreInstrumentation()
    .AddHttpClientInstrumentation()
    .AddRuntimeInstrumentation()
    .AddProcessInstrumentation()
    .AddOtlpExporter());
```

### Logs
```csharp
builder.Logging.AddOpenTelemetry(options =>
{
    options.AddOtlpExporter();
});
```

## 4. Minimal APIs Pattern

Endpoints defined directly in Program.cs without controllers:

```csharp
app.MapPost("/sandbox", () => Results.Ok(new { value = Guid.NewGuid() }));

app.MapPost("/failure/{resource}/inject", async (
    string resource,
    ISandboxCircuitBreaker circuitBreaker,
    HttpRequest request) =>
{
    var sandboxId = request.GetSandboxId();
    await circuitBreaker.OpenAsync(resource, sandboxId);
    return Results.Ok(new { value = true });
});
```

## 5. Observable Failures Pattern

Failures are designed to be captured by OpenTelemetry:

```csharp
try
{
    using var connection = new SqlConnection(connectionString);
    await connection.OpenAsync();
    // Execute query
}
catch (Exception ex)
{
    Activity.Current?.RecordException(ex);
    logger.LogError(ex, "SQL operation failed");
    return Results.Ok(new { success = false, message = ex.Message });
}
```

## 6. RxJS Reactive Patterns (Frontend)

```typescript
// Parallel status checks on init
forkJoin({
  sql: this.failureService.status('sql', this.sandboxId),
  redis: this.failureService.status('redis', this.sandboxId)
}).subscribe(statuses => {
  this.resources.sql = statuses.sql;
  this.resources.redis = statuses.redis;
});

// Sequential operation with error handling
this.flowService.executeSql(this.sandboxId).pipe(
  tap(response => this.log(response)),
  catchError(err => {
    this.log({ success: false, message: err.message });
    return EMPTY;
  })
).subscribe();
```

## 7. Configuration Externalization

Connection strings vary by circuit state:

```json
{
  "ConnectionStrings": {
    "Sql": {
      "Closed": "Server=valid-server;...",
      "Open": "Server=invalid;Connect Timeout=1;..."
    },
    "Redis": {
      "Closed": "valid-redis:6380,...",
      "Open": "invalid:6380,connectTimeout=1000,..."
    }
  }
}
```

## 8. Async-First Design

All data operations are async with cancellation support:

```csharp
app.MapPost("/flow/execute/sql", async (
    ISandboxCircuitBreaker circuitBreaker,
    HttpRequest request,
    IConfiguration config,
    ILogger<Program> logger,
    CancellationToken cancellationToken) =>
{
    // Async operations throughout
});
```

## 9. Baggage Propagation

Context flows across service boundaries:

```csharp
// Set in middleware
Baggage.SetBaggage("sandbox.id", sandboxId);

// Available anywhere in the request
var currentSandbox = Baggage.GetBaggage("sandbox.id");
```

## 10. Static SPA Serving

Production deployment serves Angular from wwwroot:

```csharp
app.UseSpaStaticFiles();
app.UseSpa(spa =>
{
    spa.Options.SourcePath = "wwwroot";
});
```
