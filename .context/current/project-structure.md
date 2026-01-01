# Project Structure

```
if-opentelemetry-chaos-simulator-sample/
│
├── src/
│   ├── Example.sln                    # Visual Studio solution file
│   │
│   ├── Example.Api/                   # ASP.NET Core backend
│   │   ├── Program.cs                 # Entry point, minimal API endpoints
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
│   │   │   └── SandboxSources.cs      # ActivitySource definition
│   │   │
│   │   └── wwwroot/                   # Static files (built SPA)
│   │
│   ├── Example.Spa/                   # Angular frontend
│   │   ├── package.json               # npm dependencies
│   │   ├── angular.json               # Angular CLI configuration
│   │   ├── tsconfig.json              # TypeScript configuration
│   │   ├── tsconfig.app.json          # App-specific TS config
│   │   ├── tsconfig.spec.json         # Test TS config
│   │   │
│   │   ├── src/
│   │   │   ├── main.ts                # Bootstrap file
│   │   │   ├── index.html             # HTML entry point
│   │   │   ├── styles.scss            # Global styles
│   │   │   │
│   │   │   ├── app/
│   │   │   │   ├── app.module.ts      # Root module
│   │   │   │   ├── app.component.ts   # Root component
│   │   │   │   ├── app.component.html # Main template
│   │   │   │   ├── app.component.scss # Component styles
│   │   │   │   ├── app-routing.module.ts   # Routing configuration
│   │   │   │   │
│   │   │   │   ├── components/
│   │   │   │   │   └── sandbox/       # Main UI component
│   │   │   │   │       ├── sandbox.component.ts
│   │   │   │   │       ├── sandbox.component.html
│   │   │   │   │       └── sandbox.component.scss
│   │   │   │   │
│   │   │   │   ├── services/
│   │   │   │   │   ├── sandbox.service.ts   # Create sandbox
│   │   │   │   │   ├── flow.service.ts      # Execute operations
│   │   │   │   │   └── failure.service.ts   # Inject/eject failures
│   │   │   │   │
│   │   │   │   └── pipes/
│   │   │   │       └── replace-line-breaks.pipe.ts
│   │   │   │
│   │   │   └── environments/
│   │   │       ├── environment.ts           # Production config
│   │   │       └── environment.development.ts
│   │   │
│   │   ├── dist/                      # Built output
│   │   └── node_modules/              # Dependencies
│   │
│   ├── Example.Worker/                # Placeholder project
│   │   └── .gitkeep
│   │
│   └── .docs/                         # Documentation
│       ├── knowledge/                 # Architecture documentation
│       └── features/                  # Feature documentation
│
├── .github/
│   └── workflows/                     # CI/CD workflows
│
├── .img/
│   └── screenshot.png                 # README screenshot
│
├── README.md                          # Project documentation
├── LICENSE                            # MIT License
└── .gitignore                         # Git ignore rules
```

## Key Directories

### Example.Api/Sandbox/
Contains all the chaos simulation and sandboxing infrastructure:
- Middleware for extracting sandbox context from requests
- Circuit breaker implementation backed by distributed cache
- OpenTelemetry configuration and extensions
- Activity/span tagging utilities

### Example.Spa/src/app/
Contains the Angular application:
- **components/sandbox**: Main UI with 3-step workflow
- **services**: API communication layer
- **pipes**: Utility pipes for display formatting

### Example.Api/wwwroot/
Static files served by ASP.NET Core. The built Angular SPA is deployed here for production.
