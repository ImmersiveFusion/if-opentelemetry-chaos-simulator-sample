# API Reference

All endpoints accept a `sandboxId` query parameter for sandbox isolation.

## Endpoints

### POST /sandbox

Creates a new sandbox with a unique identifier.

**Request:** No body required

**Response:**

```json
{
  "value": "a1b2c3d4e5f67890abcdef1234567890"
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
  "value": true
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

Executes a SQL query against the database with optional scenario selection.

**Parameters:**

- `sandboxId`: Query parameter
- `scenario`: Query parameter (optional, defaults to `success`)

**Scenarios:**

| Scenario | Description | Expects Error |
| -------- | ----------- | ------------- |
| `success` | Normal query execution - `SELECT NEWID(), GETUTCDATE()` | No |
| `wrong-table` | Query references non-existent table | Yes |
| `wrong-column` | Query references non-existent column | Yes |
| `syntax-error` | Malformed SQL syntax | Yes |
| `division-error` | Division by zero error | Yes |

**Behavior:**

- If circuit closed: Connects to valid SQL Server, executes scenario query
- If circuit open: Attempts connection to invalid endpoint, causing timeout

**Response (Success):**

```json
{
  "ID": "a1b2c3d4-...",
  "DateNowUtc": "2024-01-15T12:00:00Z"
}
```

**Response (Failure):**
Returns HTTP 500 with exception details captured in telemetry.

---

### POST /flow/execute/redis

Executes a Redis cache operation with optional scenario selection.

**Parameters:**

- `sandboxId`: Query parameter
- `scenario`: Query parameter (optional, defaults to `success`)

**Scenarios:**

| Scenario | Description | Expects Error |
| -------- | ----------- | ------------- |
| `success` | Normal SET/DELETE operation | No |
| `missing-key` | GET non-existent key (returns null) | No |
| `large-value` | Store 10KB payload | No |
| `expired-key` | Key expires immediately | No |
| `serialization-error` | Simulates corrupt data | Yes |
| `invalid-operation` | Wrong data type operation | Yes |

**Behavior:**

- If circuit closed: Connects to valid Redis, performs scenario operation
- If circuit open: Attempts connection to invalid endpoint, causing timeout

**Response (Success):**

```json
{
  "Added": "2024-01-15T12:00:00Z",
  "Removed": "2024-01-15T12:00:00Z",
  "Scenario": "success"
}
```

---

### POST /flow/execute/pipeline

Executes a multi-stage pipeline demonstrating distributed system patterns.

**Parameters:**

- `sandboxId`: Query parameter
- `scenario`: Query parameter (optional, defaults to `simple-saga`)

**Scenarios:**

| Scenario | Description |
| -------- | ----------- |
| `simple-saga` | 4 microservices with 1 instance each (4 saga spans) |
| `multi-replica-saga` | 4 microservices with 2 replicas each (8 saga spans) |

**Pipeline Stages:**

1. **Validation** - Schema, permissions, quota, rate-limit checks
2. **Data Fetch** - Parallel SQL (3 queries) and Redis (4 operations)
3. **Processing** - Transform and enrich with exponential backoff retry
4. **Distributed Transaction** - Saga pattern with simulated microservices
5. **Finalization** - Cleanup, audit logging, metrics recording

**Simulated Microservices:**

- `order-service` - Order creation and management
- `inventory-service` - Stock levels and reservations
- `payment-service` - Payment transactions
- `notification-service` - Order confirmations and alerts

Each service generates spans with:

- `peer.service`: Simulated hostname (e.g., `order-001.order-service.svc.chaos.local`)
- `server.address`, `server.port`: Service endpoint details
- `url.full`: Full simulated URL

**Response:**

```json
{
  "pipelineId": "a1b2c3d4",
  "startedAt": "2024-01-15T12:00:00Z",
  "validationPassed": true,
  "dataFetchCompleted": true,
  "processingAttempts": 1,
  "sagaServicesCommitted": 4,
  "sagaScenario": "simple-saga",
  "completedAt": "2024-01-15T12:00:01Z",
  "status": "success"
}
```

---

## Resource Keys

| Key | Description |
| --- | ----------- |
| `sql` | SQL Server database resource |
| `redis` | Redis cache resource |

## Sandbox Query Parameter

All endpoints (except `/weatherforecast`) use the `sandboxId` query parameter:

```text
GET /failure/sql/status?sandboxId=abc123
POST /flow/execute/sql?sandboxId=abc123&scenario=wrong-table
POST /flow/execute/pipeline?sandboxId=abc123&scenario=multi-replica-saga
```

The sandbox ID is propagated through OpenTelemetry Baggage and tagged on all spans for filtering in APM tools.
