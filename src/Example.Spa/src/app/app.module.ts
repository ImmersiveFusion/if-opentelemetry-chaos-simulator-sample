import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { SandboxService } from './services/sandbox.service';
import { FlowService } from './services/flow.service';


@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule
  ],
  providers: [
    SandboxService,
    FlowService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
