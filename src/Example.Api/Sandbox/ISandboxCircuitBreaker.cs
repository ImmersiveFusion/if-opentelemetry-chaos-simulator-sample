using System.Threading;

namespace Example.Api.Sandbox;

public interface ISandboxCircuitBreaker
{
    Task<bool> IsSqlOpenAsync(CancellationToken cancellationToken = default);
    Task<bool> IsRedisOpenAsync(CancellationToken cancellationToken = default);
    Task<bool> IsOpenAsync(string resource, CancellationToken cancellationToken = default);
    Task OpenAsync(string resource, CancellationToken cancellationToken = default);
    Task CloseAsync(string resource, CancellationToken cancellationToken = default);
}