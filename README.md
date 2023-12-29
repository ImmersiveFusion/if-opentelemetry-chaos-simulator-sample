

# OpenTelemetry Chaos Simulator Sample

Example Angular and .NET Core application instrumented with OpenTelemetry.

![](.img/screenshot.png)

## What is this?
This is a simple Angular/ASP.NET Core application that allows you to inject/eject failures into an application and see how those failures affect the telemetry that is generated.

## What does it do?
Allows the user to simulate intermittency of resources (or break) functionality.

## Why is this?
No code! This tool was created to enable a user to see OpenTelemetry without having to write any code but see how failures (even simulated ones) affect the generated telemetry.

## What is sandbox?
Sandboxing allows users to conduct their own experiments independently without affecting each other.

## Getting Started

### Demo

A demo of the sample is deployed to [demo.iapm.app](https://demo.iapm.app/)

Telemetry can be viewed in this grid https://my.immersivefusion.com/apm/3c4b5e00-c585-4fee-970d-9426b4f6c2db/2075ff0f-2faa-4995-aa06-76648030f440/traces?lastXMinutes=45

### Dependencies

* Angular 17+
* ASP.NET Core 8
* NodeJs

### Installing

There is no additional installation necessary outside of pre-requisite installation to run locally. 

### Executing program

Angular 
```
ng serve -o
```

ASP.NET API
```
dotnet run
```

## Contributing

This sample can be used with any OpenTelemetry tool. There is not custom code or libraries that are proprietary. 

Please feel free to add flows and improve it if you feel compelled to. 

## License

This project is licensed under the MIT License - see the LICENSE.md file for details

## Acknowledgments

Inspiration, code snippets, etc.
* [OpenTelemetry](https://opentelemetry.io/)
* [Angular default template](https://angular.io/cli/new)
* [ASP.NET Core Minimal APIs](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/minimal-apis)






