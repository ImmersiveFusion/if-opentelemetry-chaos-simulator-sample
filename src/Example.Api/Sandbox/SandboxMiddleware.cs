using System.Diagnostics;
using OpenTelemetry;

public class SandboxMiddleware : IMiddleware
{
    public Task InvokeAsync(HttpContext context, RequestDelegate next)
    {
        var sandboxId = context.Request.Query[SandboxConstants.QueryParamName].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(sandboxId))
        {
            return next(context);
        }

        Baggage.SetBaggage(SandboxConstants.TagKey, sandboxId);
        Activity.Current?.SetTag(SandboxConstants.TagKey, sandboxId);

        return next(context);

    }
}