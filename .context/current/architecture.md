# System Architecture

## Overview

The OpenTelemetry Chaos Simulator Sample is an interactive educational application that showcases OpenTelemetry observability through controlled failure injection and distributed system simulation. Users can:

1. **Inject/eject failures** into application components (SQL database and Redis cache)
2. **Execute various scenarios** including error conditions and distributed saga patterns
3. **Visualize request flow** through an animated network diagram
4. **Observe telemetry** propagation to APM backends in real-time

## Key Concepts

### Sandbox Isolation
Each user gets an isolated sandbox environment via a unique GUID identifier. This allows independent experiments without affecting other users. The sandbox ID is:
- Passed as a query parameter (`sandboxId`)
- Propagated via OpenTelemetry Baggage
- Used as a key prefix in distributed cache for circuit state
- Tagged on all spans for filtering in APM tools

### Circuit Breaker Simulation
The application simulates failures by switching between valid and invalid connection strings:
- **Closed Circuit (Normal)**: Uses valid connection strings for SQL/Redis
- **Open Circuit (Failure)**: Uses invalid connection strings causing timeouts

### Scenario-Based Testing
Beyond simple success/failure, the simulator supports multiple scenarios per resource:

**SQL Scenarios:**
- `success` - Normal query execution
- `wrong-table` - Query references non-existent table
- `wrong-column` - Query references non-existent column
- `syntax-error` - Malformed SQL syntax
- `division-error` - Division by zero error

**Redis Scenarios:**
- `success` - Normal cache operation
- `missing-key` - Get non-existent key
- `large-value` - Store 10KB payload
- `expired-key` - Immediate expiration
- `serialization-error` - Corrupt data error
- `invalid-operation` - Wrong data type operation

**Pipeline/Saga Scenarios:**
- `simple-saga` - 4 microservices with 1 instance each
- `multi-replica-saga` - 4 microservices with 2 replicas each (load-balanced)

## Component Interaction

```
+-----------------------------------------------------------------------------------+
|                              Developer Workstation                                  |
|  +------------------+  +------------------+  +------------------+                   |
|  | IAPM Desktop     |  | IAPM Web         |  | Other Tools      |                   |
|  +--------^---------+  +--------^---------+  +--------^---------+                   |
+-----------|-------------------|-------------------|------------------------------+
            |                   |                   |
            |     Telemetry flows to client tools   |
            |                   |                   |
+-----------------------------------------------------------------------------------+
|                              Cloud Sandbox                                          |
|                                                                                     |
|  +------------------+                                                               |
|  |    Angular SPA   |                                                               |
|  | +-------------+  |     +-------------------+     +------------------+            |
|  | |Network      |  |     |                   |     |  SQL Database    |            |
|  | |Diagram      |------->|   ASP.NET Core    |---->|  (scenarios)     |            |
|  | |Component    |  |     |   API Server      |     +------------------+            |
|  | +-------------+  |     |                   |                                     |
|  | +-------------+  |     | - Sandbox MW      |     +------------------+            |
|  | |Flow Service |  |     | - Circuit Breaker |---->|  Redis Cache     |            |
|  | +-------------+  |     | - Pipeline/Saga   |     |  (scenarios)     |            |
|  +------------------+     +--------+----------+     +------------------+            |
|                                    |                                                |
|                                    v                                                |
|                           +------------------+                                      |
|                           |  OpenTelemetry   |                                      |
|                           |  (OTLP Export)   |                                      |
|                           +--------+---------+                                      |
|                                    |                                                |
|                    +---------------+---------------+                                |
|                    v                               v                                |
|           +------------------+           +------------------+                       |
|           | Immersive APM    |           | Other Backends   |                       |
|           | (otlp.iapm.app)  |           | (Jaeger, etc)    |                       |
|           +------------------+           +------------------+                       |
+-----------------------------------------------------------------------------------+
```

## Network Diagram Component

The Angular SPA features an interactive network diagram that visualizes:

### Visual Elements
- **Nodes**: Client, API, SQL Database, Redis Cache, Message Broker (coming soon), Worker (coming soon), OpenTelemetry, APM backends
- **Connections**: Animated lines showing request/response flow and telemetry propagation
- **Status indicators**: Processing (pulse), Success (green), Error (red with explosion)

### Interactive Features
- **Scenario selectors**: Collapsible dropdowns for SQL, Redis, and Pipeline scenarios
- **Circuit breaker toggles**: Click connections to inject/eject failures
- **Send request buttons**: Execute operations with visual feedback
- **Status ticker**: Real-time messages showing request and telemetry flow steps
- **Fullscreen mode**: Expand diagram for presentations
- **Concurrent request mode**: Optional toggle to allow multiple simultaneous requests

### Animation Flow
1. Request dot travels from Client to API
2. API processes and forwards to target (SQL/Redis)
3. On success: Response returns via same path, telemetry fires to OTel
4. On failure: Explosion animation at failure point, error state propagates back
5. Telemetry dots flow from OTel to APM backends, then to client tools

## Pipeline/Saga Simulation

The `/flow/execute/pipeline` endpoint demonstrates complex distributed system patterns:

### Five-Stage Pipeline

1. **Validation Stage**: Schema, permissions, quota, rate-limit checks
2. **Data Fetch Stage**: Parallel SQL (3 queries) and Redis (4 operations) calls
3. **Processing Stage**: Transform and enrich with exponential backoff retry logic
4. **Distributed Transaction Stage**: Saga pattern with simulated microservices
5. **Finalization Stage**: Cleanup, audit logging, metrics recording

### Simulated Microservices (Saga Pattern)

The saga stage simulates calls to distributed services:
- `order-service` - Order creation and management
- `inventory-service` - Stock levels and reservations
- `payment-service` - Payment transactions
- `notification-service` - Order confirmations and alerts

Each service has:
- Service-specific `ActivitySource` for proper instrumentation scope
- Simulated hostname (e.g., `order-001.order-service.svc.chaos.local`)
- Standard OTel attributes: `peer.service`, `server.address`, `server.port`, `url.full`

## Telemetry Flow

1. **Request arrives** with `sandboxId` query parameter
2. **SandboxMiddleware** extracts ID, sets OpenTelemetry Baggage and Activity tags
3. **Instrumentation auto-captures**:
   - HTTP request/response details
   - SQL queries and parameters (with scenario context)
   - Redis commands
   - Custom pipeline stages and saga operations
   - Runtime metrics
4. **Service-specific ActivitySources** create properly scoped spans for saga services
5. **Logs** are captured with sandbox context
6. **OTLP Exporter** sends traces, metrics, and logs to backend
7. **APM** displays telemetry filtered by sandbox.id

## User Flow

1. **Configure**: Select scenarios for SQL, Redis, or Pipeline operations
2. **Break/Fix**: Toggle circuit breakers for SQL and Redis resources
3. **Execute**: Run operations and watch the animated flow
4. **Visualize**: View results in status ticker, terminal output, or APM dashboard

## Data Stores

| Store | Purpose |
|-------|---------|
| SQL Server | Demonstrates database operations with various error scenarios |
| Redis | Demonstrates cache operations with edge cases |
| IDistributedCache | Stores circuit breaker state per sandbox (in-memory) |