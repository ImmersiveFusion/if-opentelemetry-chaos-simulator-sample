import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { 
    HTTP_INTERCEPTORS, 
    HttpClient, 
    provideHttpClient, 
    withInterceptorsFromDi 
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
        AppRoutingModule
    ],
    providers: [
        SandboxService,
        FlowService,
        ReplaceLineBreaksPipe,
        provideHttpClient(withInterceptorsFromDi()),
    ],
    bootstrap: [AppComponent]
})
export class AppModule { }
