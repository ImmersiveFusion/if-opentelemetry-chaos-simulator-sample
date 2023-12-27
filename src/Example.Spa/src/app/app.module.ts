import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import {
  HttpClientModule,
  HTTP_INTERCEPTORS,
  HttpClient,
} from "@angular/common/http";

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { SandboxComponent } from './sandbox/sandbox.component';

import { SandboxService } from './services/sandbox.service';
import { FlowService } from './services/flow.service';



@NgModule({
  declarations: [
    AppComponent,
    SandboxComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule
  ],
  providers: [
    SandboxService,
    FlowService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
