# API Reference

All endpoints accept a `sandboxId` query parameter for sandbox isolation.

## Endpoints

### POST /sandbox
Creates a new sandbox with a unique identifier.

**Request:** No body required

**Response:**
```json
{
  "value": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

---

### GET /weatherforecast
Demo endpoint returning randomized weather data.

**Response:**
```json
[
  {
    "date": "2024-01-15",
    "temperatureC": 25,
    "temperatureF": 77,
    "summary": "Warm"
  }
]
```

---

### GET /failure/{resource}/status
Checks if a resource's circuit is open (failing) or closed (normal).

**Parameters:**
- `resource`: Resource identifier (`sql` or `redis`)
- `sandboxId`: Query parameter for sandbox isolation

**Response:**
```json
{
  "value": true  // true = circuit open (failing), false = circuit closed (normal)
}
```

---

### POST /failure/{resource}/inject
Opens the circuit breaker for a resource, simulating a failure.

**Parameters:**
- `resource`: Resource identifier (`sql` or `redis`)
- `sandboxId`: Query parameter

**Response:**
```json
{
  "value": true
}
```

---

### POST /failure/{resource}/eject
Closes the circuit breaker for a resource, restoring normal operation.

**Parameters:**
- `resource`: Resource identifier (`sql` or `redis`)
- `sandboxId`: Query parameter

**Response:**
```json
{
  "value": true
}
```

---

### POST /flow/execute/sql
Executes a SQL query against the database.

**Parameters:**
- `sandboxId`: Query parameter

**Behavior:**
- If circuit closed: Connects to valid SQL Server, executes `SELECT NEWID() as ID, GETUTCDATE() as [DateNowUtc]`
- If circuit open: Attempts connection to invalid endpoint, causing timeout/failure

**Response (Success):**
```json
{
  "success": true,
  "message": "Query executed successfully",
  "data": {
    "id": "...",
    "dateNowUtc": "..."
  }
}
```

**Response (Failure):**
```json
{
  "success": false,
  "message": "Connection timeout error message"
}
```

---

### POST /flow/execute/redis
Executes a Redis cache operation (SET then DELETE).

**Parameters:**
- `sandboxId`: Query parameter

**Behavior:**
- If circuit closed: Connects to valid Redis, performs cache operation
- If circuit open: Attempts connection to invalid endpoint, causing timeout/failure

**Response (Success):**
```json
{
  "success": true,
  "message": "Cache operation completed"
}
```

**Response (Failure):**
```json
{
  "success": false,
  "message": "Redis connection error message"
}
```

---

## Resource Keys

| Key | Description |
|-----|-------------|
| `sql` | SQL Server database resource |
| `redis` | Redis cache resource |

## Sandbox Query Parameter

All endpoints (except `/weatherforecast`) use the `sandboxId` query parameter:

```
GET /failure/sql/status?sandboxId=abc123
POST /flow/execute/sql?sandboxId=abc123
```

The sandbox ID is propagated through OpenTelemetry Baggage and tagged on all spans for filtering in APM tools.
