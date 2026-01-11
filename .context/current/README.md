# OpenTelemetry Chaos Simulator - Context

This folder contains architecture documentation for the OpenTelemetry Chaos Simulator Sample.

## Contents

- [architecture.md](architecture.md) - System architecture, network diagram, pipeline/saga simulation
- [technology-stack.md](technology-stack.md) - Technologies and frameworks used
- [project-structure.md](project-structure.md) - Folder structure and organization
- [api-reference.md](api-reference.md) - Backend API endpoints with scenarios
- [patterns.md](patterns.md) - Design patterns and practices
- [configuration.md](configuration.md) - Configuration and setup guide

## Quick Overview

The Chaos Simulator is an interactive educational application that demonstrates OpenTelemetry observability through:

1. **Circuit breaker simulation** - Inject/eject failures for SQL and Redis
2. **Scenario-based testing** - Multiple error conditions per resource
3. **Pipeline/Saga simulation** - Distributed microservice transaction patterns
4. **Animated network diagram** - Visual request flow with status ticker
5. **Real-time telemetry** - Traces, metrics, and logs to APM backends

## Related

- **Azure DevOps**: [Work Item 2027](https://dev.azure.com/ImmersiveFusion/IF.Work/_workitems/edit/2027)
- **Epic**: IAPM 1.10.x Chaos Sim feature
