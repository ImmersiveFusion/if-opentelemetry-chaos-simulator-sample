# System Architecture

## Overview

The OpenTelemetry Chaos Simulator Sample is an educational demonstration application that showcases OpenTelemetry observability through controlled failure injection. Users can inject and eject failures into application components (SQL database and Redis cache) and observe how these failures propagate through traces, metrics, and logs.

## Key Concepts

### Sandbox Isolation
Each user gets an isolated sandbox environment via a unique GUID identifier. This allows independent experiments without affecting other users. The sandbox ID is:
- Passed as a query parameter (`sandboxId`)
- Propagated via OpenTelemetry Baggage
- Used as a key prefix in distributed cache for circuit state

### Circuit Breaker Simulation
The application simulates failures by switching between valid and invalid connection strings:
- **Closed Circuit (Normal)**: Uses valid connection strings for SQL/Redis
- **Open Circuit (Failure)**: Uses invalid connection strings causing timeouts

## Component Interaction

```
┌─────────────────────────────────────────────────────────────────┐
│                        Angular SPA                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │SandboxService│  │ FlowService  │  │FailureService│          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
└─────────┼─────────────────┼─────────────────┼───────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ASP.NET Core API                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  SandboxMiddleware                       │    │
│  │        (Extract sandboxId, set Baggage/Activity)        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Minimal API Endpoints                  │    │
│  │  /sandbox  /failure/{resource}/*  /flow/execute/*       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │               SandboxCircuitBreaker                      │    │
│  │     (IDistributedCache-backed circuit state)            │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
          │                                   │
          ▼                                   ▼
   ┌──────────────┐                   ┌──────────────┐
   │  SQL Server  │                   │    Redis     │
   └──────────────┘                   └──────────────┘
          │                                   │
          └───────────────┬───────────────────┘
                          ▼
               ┌──────────────────┐
               │  OTLP Exporter   │
               │ (otlp.iapm.app)  │
               └──────────────────┘
                          │
                          ▼
               ┌──────────────────┐
               │  Immersive APM   │
               │  (Visualization) │
               └──────────────────┘
```

## Telemetry Flow

1. **Request arrives** with `sandboxId` query parameter
2. **SandboxMiddleware** extracts ID, sets OpenTelemetry Baggage and Activity tags
3. **Instrumentation auto-captures**:
   - HTTP request/response details
   - SQL queries and parameters
   - Redis commands
   - Runtime metrics
4. **Logs** are captured with sandbox context
5. **OTLP Exporter** sends traces, metrics, and logs to backend
6. **APM** displays telemetry filtered by sandbox.id

## Three-Step User Flow

1. **Break/Fix**: Toggle circuit breakers for SQL and Redis resources
2. **Execute**: Run operations against SQL or Redis to generate telemetry
3. **Visualize**: View results in terminal output or APM dashboard

## Data Stores

| Store | Purpose |
|-------|---------|
| SQL Server | Demonstrates database operations and failure propagation |
| Redis | Demonstrates cache operations and distributed caching failures |
| IDistributedCache | Stores circuit breaker state per sandbox (in-memory) |
