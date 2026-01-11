# OpenTelemetry Chaos Simulator

Interactive chaos engineering sandbox for exploring OpenTelemetry observability with failure injection.

![](.img/screenshot.png)

## What is this?

A zero-config, hands-on application for experimenting with chaos engineering and observability. Unlike traditional demos that require Docker, Kubernetes, or complex setup, this simulator lets you experience OpenTelemetry in under 5 minutes.

**Key Value:** See exactly how failures propagate through distributed systems and appear in APM tools - without writing any code.

## Live Demo

Try it now at **[demo.iapm.app](https://demo.iapm.app/)**

1. Create a sandbox (automatic on first visit)
2. Click connections to inject failures
3. Run SQL/Redis/Pipeline scenarios
4. Watch animated request flows
5. View traces in [Immersive APM](https://my.iapm.app/apm/3c4b5e00-c585-4fee-970d-9426b4f6c2db/2075ff0f-2faa-4995-aa06-76648030f440/traces)

## Features

### Interactive Network Visualization
- **Animated Request Flows** - Cyan photon dots travel Client → API → Database → Client
- **Telemetry Streams** - Orange/blue dots show data flowing to OpenTelemetry and APM
- **Real-time Health** - Green/red pulsing indicators show connection status
- **Click-to-Break** - Inject failures by clicking any connection line

### Chaos Scenarios

**SQL Database (5 scenarios)**
| Scenario | What Happens |
|----------|--------------|
| Success | Normal query execution |
| Wrong Table | Query non-existent table |
| Wrong Column | Query non-existent column |
| Syntax Error | Malformed SQL statement |
| Division Error | Division by zero |

**Redis Cache (6 scenarios)**
| Scenario | What Happens |
|----------|--------------|
| Success | Normal SET → DELETE |
| Missing Key | GET non-existent key |
| Large Value | Store 10KB payload |
| Expired Key | Key expires immediately |
| Serialization | Corrupt data detection |
| Invalid Op | Wrong data type operation |

**Pipeline/Saga (2 scenarios)**
| Scenario | What Happens |
|----------|--------------|
| Simple Saga | 4 microservices × 1 instance (4 spans) |
| Multi-Replica | 4 microservices × 2 replicas (8 spans) |

### OpenTelemetry Integration

All three pillars fully instrumented:

```
TRACES   → AspNetCore, HttpClient, SqlClient, Redis, Custom spans
METRICS  → Runtime, Process, HTTP request/response metrics
LOGS     → Structured logging with trace correlation
```

**Automatic Instrumentation:**
- SQL queries with full statement capture
- Redis operations with command details
- HTTP requests with headers and timing
- Custom spans for saga/pipeline simulation

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Developer Workstation                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ IAPM Desktop │  │   IAPM Web   │  │ Other Tools  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ Telemetry
┌─────────────────────────────┼───────────────────────────────┐
│  APM Cloud Services         │                               │
│  ┌──────────────┐  ┌────────┴─────┐  ┌──────────────┐       │
│  │  IAPM Cloud  │◀─│OpenTelemetry │─▶│Other Plumbing│       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │ OTLP Export
┌─────────────────────────────┼───────────────────────────────┐
│  Chaos Sandbox              │                               │
│                    ┌────────┴─────┐                         │
│  ┌──────────┐     │     API      │                         │
│  │  Client  │────▶│  (ASP.NET)   │                         │
│  └──────────┘     └───────┬──────┘                         │
│                     ┌─────┴─────┐                           │
│                     ▼           ▼                           │
│              ┌──────────┐ ┌──────────┐                      │
│              │   SQL    │ │  Redis   │  ← Circuit Breakers  │
│              └──────────┘ └──────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

## How It Works

### Sandbox Isolation
Each user gets a unique sandbox ID (GUID). All telemetry is tagged with this ID, enabling:
- Independent chaos experiments
- Filtered APM views per user
- No interference between sessions

### Circuit Breaker Pattern
Failures are injected via circuit breakers backed by distributed cache:
- **Closed (healthy)** → Uses valid connection strings
- **Open (broken)** → Uses invalid endpoints with short timeouts

### Context Propagation
```csharp
// Middleware sets baggage for all downstream operations
Baggage.SetBaggage("sandbox.id", sandboxId);
Activity.Current?.SetTag("sandbox.id", sandboxId);
```

## Comparison with Prior Art

| Feature | This Simulator | OTel Astronomy Shop | Chaos Mesh + OTel |
|---------|----------------|---------------------|-------------------|
| **Setup Time** | ~2 minutes | ~30 minutes | Hours |
| **Languages** | 2 (.NET, TS) | 12+ | Varies |
| **Services** | 1 + simulated | 20+ real | Real services |
| **Visual Learning** | Animated diagram | Static | Dashboard |
| **Chaos Built-in** | Yes | No (add-on) | Yes |
| **Target** | Beginners | Intermediate | Production |

**Best for:** First exposure to observability, sales demos, quick POCs, .NET developers

**Not for:** Deep OTel internals, multi-language systems, production chaos testing

## Running Locally

### Prerequisites
- Node.js 18+
- .NET 9 SDK
- SQL Server (local or Azure)
- Redis (local or Azure)

### Frontend (Angular 21)
```bash
cd src/Example.Spa
npm install
ng serve -o
```

### Backend (ASP.NET Core 9)
```bash
cd src/Example.Api
dotnet run
```

### Configuration
Edit `appsettings.json` for custom OTLP endpoints:
```json
{
  "Otlp": {
    "Endpoint": "https://otlp.iapm.app",
    "ApiKey": "your-api-key"
  }
}
```

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | Angular | 21.0.3 |
| Frontend | TypeScript | 5.9.3 |
| Backend | ASP.NET Core | 9.0 |
| Telemetry | OpenTelemetry | 1.12.0 |
| Database | SQL Server | Any |
| Cache | Redis | Any |

## Project Structure

```
src/
├── Example.Api/                 # ASP.NET Core backend
│   ├── Program.cs               # Minimal APIs + OTel config
│   ├── Sandbox/                 # Chaos infrastructure
│   │   ├── SandboxMiddleware    # Context propagation
│   │   ├── SandboxCircuitBreaker# Failure injection
│   │   └── SandboxExtensions    # OTel setup
│   └── appsettings.json         # Configuration
│
├── Example.Spa/                 # Angular frontend
│   └── src/app/
│       ├── components/
│       │   ├── sandbox/         # Main UI
│       │   └── network-diagram/ # Visualization
│       └── services/            # API clients
│
└── .context/                    # Documentation
```

## What This Is Not

This is an educational tool, not a comprehensive OpenTelemetry reference. For exhaustive OTel capabilities across 12+ languages, see the [official OpenTelemetry Demo](https://github.com/open-telemetry/opentelemetry-demo).

## Contributing

This sample works with any OpenTelemetry-compatible backend. Contributions welcome:
- Additional chaos scenarios
- New visualization features
- Alternative APM integrations
- Documentation improvements

## Connect

[Email](mailto:info@immersivefusion.com) |
[LinkedIn](https://www.linkedin.com/company/immersivefusion) |
[Discord](https://discord.gg/zevywnQp6K) |
[GitHub](https://github.com/immersivefusion) |
[Twitter/X](https://twitter.com/immersivefusion) |
[YouTube](https://www.youtube.com/@immersivefusion)

[Try Immersive APM](https://immersivefusion.com/landing/default) for your own projects

## License

MIT License - see [LICENSE](LICENSE)

## Acknowledgments

- [OpenTelemetry](https://opentelemetry.io/) - The observability framework
- [Angular](https://angular.dev/) - Frontend framework
- [ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/) - Backend framework
- [Immersive Fusion](https://immersivefusion.com/) - APM visualization
