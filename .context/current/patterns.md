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
- Open circuit: uses invalid connection string causing timeout
- Closed circuit: uses valid connection string for normal operation

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

## 3. Scenario-Based Testing Pattern

Operations support multiple predefined scenarios mapped to safe, hardcoded queries:

```csharp
var query = scenario.ToLowerInvariant() switch
{
    "wrong-table" => "SELECT NEWID() as ID FROM NonExistentTable_12345",
    "wrong-column" => "SELECT NonExistentColumn_XYZ FROM sys.tables",
    "syntax-error" => "SELECT * FROM @InvalidSyntax!!!",
    "division-error" => "SELECT 1/0 as Result",
    _ => "SELECT NEWID() as ID, GETUTCDATE() as [DateNowUtc]"
};
```

**Benefits:**

- No SQL injection risk (no user input in queries)
- Reproducible error conditions
- Clear error categorization in telemetry

## 4. Service-Specific ActivitySource Pattern

For saga simulation, each service gets its own ActivitySource:

```csharp
public static class SandboxSources
{
    public static readonly ActivitySource DefaultActivitySource =
        new("Example.Api.Sandbox");

    private static readonly ConcurrentDictionary<string, ActivitySource> ServiceSources = new();

    public static ActivitySource GetServiceSource(string serviceName)
    {
        return ServiceSources.GetOrAdd(serviceName,
            name => new ActivitySource($"Example.Api.Sandbox.{name}"));
    }
}
```

**Benefits:**

- Proper service topology in APM tools
- Realistic distributed tracing simulation
- Standard OTel semantic conventions

## 5. Pipeline/Saga Pattern

Multi-stage pipeline with simulated distributed transactions:

```csharp
// Stage 4: Saga Pattern
foreach (var (service, instanceId) in serviceInstances)
{
    var serviceSource = SandboxSources.GetServiceSource(service);
    using var serviceActivity = serviceSource.StartActivity("Saga.Commit", ActivityKind.Client);

    var serviceHost = $"{instanceId}.{service}.svc.chaos.local";
    serviceActivity?.SetTag("peer.service", serviceHost);
    serviceActivity?.SetTag("server.address", serviceHost);
    serviceActivity?.SetTag("url.full", $"https://{serviceHost}:8080/saga/commit");

    await Task.Delay(75, cancellationToken);
    serviceActivity?.SetTag("saga.committed", true);
}
```

**Simulated Services:**

- `order-service` - Order management
- `inventory-service` - Stock management
- `payment-service` - Payment processing
- `notification-service` - Notifications

## 6. OpenTelemetry Three Pillars

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

## 7. Minimal APIs Pattern

Endpoints defined directly in Program.cs:

```csharp
app.MapPost("/sandbox", () => Results.Ok(new { value = Guid.NewGuid() }));

app.MapPost("/flow/execute/sql", async (
    HttpRequest request,
    ISandboxCircuitBreaker circuitBreaker,
    IConfiguration config,
    CancellationToken cancellationToken) =>
{
    var scenario = request.Query["scenario"].FirstOrDefault() ?? "success";
    // Execute scenario...
});
```

## 8. Animated Flow Visualization Pattern

Frontend uses SVG-based animations to visualize request flow:

```typescript
private async animateDot(fromNodeId: string, toNodeId: string, duration: number): Promise<void> {
    const steps = 30;
    const stepDuration = duration / steps;

    for (let i = 0; i <= steps; i++) {
        this.requestDotPosition = {
            fromNode: fromNodeId,
            toNode: toNodeId,
            progress: i / steps
        };
        await this.delay(stepDuration);
    }
}
```

**Visual States:**

- `idle` - No activity
- `processing` - Pulsing animation
- `success` - Green indicator
- `error` - Red with explosion effect

## 9. Status Ticker Pattern

Real-time message queue for flow visibility:

```typescript
private addStatusMessage(text: string, type: 'request' | 'telemetry'): void {
    const id = ++this.messageIdCounter;
    const step = ++this.stepCounter;
    this.statusMessages.push({ id, text, type, step });

    // Sequential disappearance with stagger delay
    const disappearTime = Math.max(now + baseDelay, this.lastDisappearTime + staggerDelay);
    setTimeout(() => {
        this.statusMessages = this.statusMessages.filter(m => m.id !== id);
    }, delay);
}
```

## 10. Baggage Propagation

Context flows across service boundaries:

```csharp
// Set in middleware
Baggage.SetBaggage("sandbox.id", sandboxId);

// Available anywhere in the request
var currentSandbox = Baggage.GetBaggage("sandbox.id");
```

## 11. Exponential Backoff Retry Pattern

Pipeline processing includes retry simulation:

```csharp
while (attempt < maxRetries)
{
    attempt++;
    using var attemptActivity = SandboxSources.DefaultActivitySource
        .StartActivity($"Process.Attempt.{attempt}");

    if (shouldSimulateFailure && attempt < maxRetries)
    {
        var backoffMs = (int)Math.Pow(2, attempt) * 100;
        attemptActivity?.SetStatus(ActivityStatusCode.Error, "Transient failure");

        using var backoffActivity = SandboxSources.DefaultActivitySource
            .StartActivity("Retry.Backoff");
        backoffActivity?.SetTag("backoff.ms", backoffMs);
        backoffActivity?.SetTag("backoff.strategy", "exponential");
        await Task.Delay(backoffMs, cancellationToken);
        continue;
    }
    break;
}
```
