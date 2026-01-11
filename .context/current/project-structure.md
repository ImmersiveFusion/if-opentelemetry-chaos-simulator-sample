# Project Structure

```text
if-opentelemetry-chaos-simulator-sample/
│
├── src/
│   ├── Example.sln                    # Visual Studio solution file
│   │
│   ├── Example.Api/                   # ASP.NET Core backend
│   │   ├── Program.cs                 # Entry point, minimal API endpoints, pipeline/saga
│   │   ├── GlobalUsings.cs            # Global using directives
│   │   ├── WeatherForecast.cs         # Demo data model (record type)
│   │   ├── Example.Api.csproj         # Project file (NET 9.0)
│   │   ├── appsettings.json           # Production configuration
│   │   ├── appsettings.Development.json  # Development configuration
│   │   │
│   │   ├── Properties/
│   │   │   └── launchSettings.json    # Launch profiles and connection strings
│   │   │
│   │   ├── Sandbox/                   # Chaos simulation infrastructure
│   │   │   ├── SandboxConstants.cs    # Constants (query param, resource keys)
│   │   │   ├── SandboxMiddleware.cs   # HTTP middleware for sandbox context
│   │   │   ├── SandboxExtensions.cs   # OpenTelemetry configuration
│   │   │   ├── SandboxCircuitBreaker.cs    # Circuit breaker implementation
│   │   │   ├── ISandboxCircuitBreaker.cs   # Circuit breaker interface
│   │   │   ├── ActivityExtensions.cs  # OpenTelemetry Activity tagging
│   │   │   ├── HttpRequestExtensions.cs    # Sandbox ID extraction
│   │   │   └── SandboxSources.cs      # ActivitySource definitions
│   │   │
│   │   └── wwwroot/                   # Static files (built SPA)
│   │
│   ├── Example.Spa/                   # Angular frontend
│   │   ├── package.json               # npm dependencies
│   │   ├── angular.json               # Angular CLI configuration
│   │   ├── tsconfig.json              # TypeScript configuration
│   │   │
│   │   ├── src/
│   │   │   ├── main.ts                # Bootstrap file
│   │   │   ├── index.html             # HTML entry point
│   │   │   ├── styles.scss            # Global styles
│   │   │   │
│   │   │   ├── app/
│   │   │   │   ├── app.module.ts      # Root module
│   │   │   │   ├── app.component.ts   # Root component
│   │   │   │   │
│   │   │   │   ├── components/
│   │   │   │   │   ├── sandbox/            # Main sandbox controller
│   │   │   │   │   └── network-diagram/    # Interactive flow visualization
│   │   │   │   │
│   │   │   │   ├── services/
│   │   │   │   │   ├── sandbox.service.ts   # Create sandbox
│   │   │   │   │   ├── flow.service.ts      # Execute operations
│   │   │   │   │   └── failure.service.ts   # Inject/eject failures
│   │   │   │   │
│   │   │   │   └── pipes/
│   │   │   │
│   │   │   └── environments/
│   │   │
│   │   └── dist/                      # Built output
│   │
│   └── Example.Worker/                # Placeholder (coming soon)
│
├── .context/                          # Project context documentation
│   └── current/                       # Current architecture docs
│
├── .docs/
│   └── features/                      # Feature documentation
│
├── .github/
│   └── workflows/                     # CI/CD workflows
│
├── README.md                          # Project documentation
└── LICENSE                            # MIT License
```

## Key Directories

### Example.Api/Sandbox/

Chaos simulation and sandboxing infrastructure:

- **SandboxMiddleware**: Extracts sandbox context, sets Baggage/Activity tags
- **SandboxCircuitBreaker**: Circuit breaker backed by distributed cache
- **SandboxSources**: ActivitySource definitions including service-specific sources for saga simulation
- **SandboxExtensions**: OpenTelemetry configuration

### Example.Spa/src/app/components/

Angular application components:

- **sandbox/**: Main controller component
- **network-diagram/**: Interactive SVG-based visualization with animated request flow, scenario selectors, status ticker

### Example.Spa/src/app/services/

API communication layer:

- **flow.service.ts**: Executes SQL, Redis, and Pipeline operations with scenario support
- **failure.service.ts**: Injects/ejects circuit breaker failures
