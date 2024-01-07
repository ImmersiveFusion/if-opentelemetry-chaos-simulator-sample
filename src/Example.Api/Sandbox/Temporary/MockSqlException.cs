using Example.Api.Sandbox.Temporary;

public class MockSqlException : MockRedisException
{
    public MockSqlException(string message) : base(message) { }
}