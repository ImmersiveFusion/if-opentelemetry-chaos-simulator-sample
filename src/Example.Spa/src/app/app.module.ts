import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import {
  HttpClientModule,
  HTTP_INTERCEPTORS,
  HttpClient,
} from "@angular/common/http";

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { SandboxComponent } from './components/sandbox/sandbox.component';

import { SandboxService } from './services/sandbox.service';
import { FlowService } from './services/flow.service';
import { ReplaceLineBreaksPipe } from './pipes/replace-line-breaks.pipe';
import { CompositePropagatorModule, OpenTelemetryInterceptorModule, OtelColExporterModule } from '@jufab/opentelemetry-angular-interceptor';
import { environment } from 'src/environments/environment';



@NgModule({
  declarations: [
    AppComponent,
    SandboxComponent,
    ReplaceLineBreaksPipe
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,

    OpenTelemetryInterceptorModule.forRoot({
      commonConfig: {
        console: !environment.production,
        production: environment.production,
        serviceName: 'ui', // Service name send in trace
        probabilitySampler: '1',
      },
      otelcolConfig: {
      
        url: environment.otlpCollectorUrl,
        // headers: {
        //   'X-Api-Version': '2.0'
        // }
      },
    }),
    //Insert OtelCol exporter module
    OtelColExporterModule,
    //Insert propagator module
    CompositePropagatorModule
  ],
  providers: [
    SandboxService,
    FlowService,
    ReplaceLineBreaksPipe,
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
