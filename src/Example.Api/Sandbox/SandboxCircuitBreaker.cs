namespace Example.Api.Sandbox;

public class SandboxCircuitBreaker : ISandboxCircuitBreaker
{
    private readonly IHttpContextAccessor _accessor;
    private readonly IDistributedCache _cache;

    public SandboxCircuitBreaker(IHttpContextAccessor accessor, IDistributedCache cache)
    {
        _accessor = accessor;
        _cache = cache;
    }

    public Task<bool> IsSqlOpenAsync(CancellationToken cancellationToken = default)
    {
        return IsOpenAsync(SandboxConstants.ResourceKeys.Sql, cancellationToken);
    }

    public Task<bool> IsRedisOpenAsync(CancellationToken cancellationToken = default)
    {
        return IsOpenAsync(SandboxConstants.ResourceKeys.Redis, cancellationToken);
    }

    public async Task<bool> IsOpenAsync(string resource, CancellationToken cancellationToken = default)
    {
        var sandboxId = _accessor.HttpContext?.Request.GetSandboxId();

        if (sandboxId == null)
        {
            return false;
        }

        var exists = await _cache.GetAsync($"{sandboxId}/{resource}", cancellationToken);

        return exists != null;
    }

    public async Task OpenAsync(string resource, CancellationToken cancellationToken = default)
    {
        var sandboxId = _accessor.HttpContext?.Request.GetSandboxId();

        if (sandboxId == null)
        {
            return;
        }

        await _cache.SetAsync($"{sandboxId}/{resource}", Array.Empty<byte>(), token: cancellationToken);
    }

    public async Task CloseAsync(string resource, CancellationToken cancellationToken = default)
    {
        var sandboxId = _accessor.HttpContext?.Request.GetSandboxId();

        if (sandboxId == null)
        {
            return;
        }

        await _cache.RemoveAsync($"{sandboxId}/{resource}", cancellationToken);
    }
}