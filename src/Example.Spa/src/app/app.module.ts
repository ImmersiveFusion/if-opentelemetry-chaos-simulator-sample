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



@NgModule({
  declarations: [
    AppComponent,
    SandboxComponent,
    ReplaceLineBreaksPipe
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule
  ],
  providers: [
    SandboxService,
    FlowService,
    ReplaceLineBreaksPipe,
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
