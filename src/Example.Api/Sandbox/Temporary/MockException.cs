namespace Example.Api.Sandbox.Temporary;

/// <remarks>
/// This is a temporary failure injection mechanism until we get Polly.Simmy in place or something similar
/// </remarks>
public class MockException : Exception
{  
    public string Message { get; }

    protected MockException(string message)
    {
        Message = message;
    }


}