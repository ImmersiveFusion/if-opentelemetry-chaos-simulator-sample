import { Component, EventEmitter, OnInit } from '@angular/core';
import { SandboxService } from '../../services/sandbox.service';
import { FlowService } from '../../services/flow.service';
import { catchError, first, forkJoin, merge, of, switchMap, tap } from 'rxjs';
import { FailureService } from '../../services/failure.service';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-sandbox',
  templateUrl: './sandbox.component.html',
  styleUrl: './sandbox.component.scss'
})
export class SandboxComponent implements OnInit {
  showMoreHelp = false;
  sandboxId?: string;

  generateSandboxEvent = new EventEmitter<boolean>;
  output: string[] = [];

  isRunning = 0;

  resources:{ [id: string] : boolean } = {
    'sql': false,
    'redis': false
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sandboxService: SandboxService,
    private flowService: FlowService,
    private failureService: FailureService,

  ) {
  }

  ngOnInit(): void {
    this.sandboxId = (this.route.snapshot.params as any).sandboxId;

    merge(this.generateSandboxEvent)
      .pipe(
        switchMap(() => this.sandboxService.get()),
        catchError((e) => {
          //console.log(e)
          return of({});
        }
        ))
      .subscribe((response) => {

        const sandboxId = response.value;

        if (sandboxId) {
          window.location.href = `/sandbox/${sandboxId}`;
        }
      })


    if (!this.sandboxId) {

      this.generateSandboxEvent.next(true);

    }
    else {
      //sandbox ready to use
      this.terminalLog('Sandbox ready');
    }

    const resourceKeys = this.getResourceKeys();
    const callbacks = resourceKeys.map(r => this.failureService.status(r, this.sandboxId!));

    forkJoin(callbacks).pipe(first()).subscribe(results => {
      results.forEach((r, i) => {
        this.resources[resourceKeys[i]] = r.value;
      });
    });
  }

  getResourceKeys() : string[]
  {
    return Object.keys(this.resources);
  }

  private terminalLog(message: string) {
    this.output.push(`> ${message}`);
  }

  regenerateSandbox() {
    this.generateSandboxEvent.next(true);
  }

  copySandboxIdToClipboard()
  {
    if (!this.sandboxId)
    {
      return;
    }

    // Copy the text inside the text field
    navigator.clipboard.writeText(this.sandboxId!);
  }

  clearTerminal()
  {
    this.output = [];
  }

  toggle(resource: string) {

    this.isRunning++;

    if (this.resources[resource]) //open?
    {
      this.terminalLog(`Fixing (ejecting the error from) ${resource}. Please wait... (if this fails, there is an issue with sample application and/or its deployment)`)

      this.failureService.eject(resource, this.sandboxId!)
      .pipe(catchError(e => {
        this.terminalLog(`[FAILURE]: ${resource} could not break: ${JSON.stringify(e)}`)
        return of({failed: true});
      }),first())
      .subscribe((response) => {
        this.isRunning--;

        if (response.failed)
        {
          return;
        }         

        
        this.resources[resource] = false;
        this.terminalLog(`${resource} switched to 'available' (circuit is closed)`);

      });
    }
    else
    {
      this.terminalLog(`Breaking (injecting error into) ${resource}. Please wait... (if this fails, there is an issue with sample application and/or its deployment)`)

      this.failureService.inject(resource, this.sandboxId!)
      .pipe(catchError(e => {
        this.terminalLog(`[FAILURE]: ${resource} could not break: ${JSON.stringify(e)}`)
        return of({failed: true});
      }),first())
      .subscribe((response) => {
        this.isRunning--;

        if (response.failed)
        {
          return;
        }         


        this.resources[resource] = true;
        this.terminalLog(`${resource} switched to 'unavailable' (circuit is open)`);
      });
    }

  }

  execute(resource: string) {
    
    this.terminalLog(`Executing ${resource} request. Please wait... (if failure was injected this may take a few seconds)`)
    
    this.isRunning++;

    switch(resource)
    {
      case 'sql':
        this.flowService.executeSql(this.sandboxId!)
        .pipe(
          tap(() => {
            //nothing  
          }),
          catchError(e => {
            this.terminalLog(`[FAILURE]: ${resource} request failed to complete successfully: ${JSON.stringify(e)}`)
            return of({failed: true});
          }),
          first())
          
        .subscribe((response: any) => {
          this.isRunning--;
          
          if (response.failed)
          {
            return;
          }         

          this.terminalLog(`[SUCCESS]: ${resource} completed successfully: ${JSON.stringify(response.value)}`)
        });
        break;
      case 'redis':
        this.flowService.executeRedis(this.sandboxId!)
        .pipe(
          tap(() => {
            //nothing  
          }),
          catchError(e => {
            this.terminalLog(`[FAILURE]: ${resource} request failed to complete successfully: ${JSON.stringify(e)}`)
            return of({failed: true});
          }),
          first())
        .subscribe((response: any) => {
          this.isRunning--;
          
          if (response.failed)
          {
            return;
          }

          this.terminalLog(`[SUCCESS]: ${resource} completed successfully: ${JSON.stringify(response.value)}`)

        });
        break;
        default:
          this.isRunning--;
    }
  }

  visualize() {

    if (!this.sandboxId)
    {
      return;
    }

    environment.visualize(this.sandboxId!);
  }

  
  startSubscription() {
    window.open(environment.subscriptionUrl);
  }

  clone() {
    window.open(environment.gitHubUrl);
  }
}
