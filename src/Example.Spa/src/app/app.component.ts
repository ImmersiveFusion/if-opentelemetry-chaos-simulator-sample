import { Component } from '@angular/core';
import { SandboxService } from './services/sandbox.service';
import { FlowService } from './services/flow.service';
import { first } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'Example.Spa';
  showMoreHelp = false;
  sandboxId = 123;

  resources = ['sql', 'redis'];
  circuit: { [key: string] : string; }  = {};
  status: { [key: string]: string } = {};

  const decode = (str: string):string => Buffer.from(str, 'base64').toString('binary');
  const encode = (str: string):string => Buffer.from(str, 'binary').toString('base64');


  constructor(
    private sandboxService: SandboxService,
    private flowService: FlowService
     )
     {
      this.resources.forEach(r =>{
        this.circuit[r] = 'operational';
        this.status[r] = '200 OK';
      })

     }


    test(resource: string)
    {
      this.flowService.run(resource).pipe(
        first(),

      ).subscribe(output => {

        this.status[resource] = output;
      });
    }

     toggle(resource: string){
      switch(this.circuit[resource])
      {
        case 'operational':
          this.sandboxService.open(resource);
          this.circuit[resource] ='unavailable';
          break;
        case 'unavallable':
        default:
          this.sandboxService.close(resource);
          this.circuit[resource] ='operational';
          break;
      }
     }

     visualize()
     {
        
     }

     clone()
     {
      
     } 



}
