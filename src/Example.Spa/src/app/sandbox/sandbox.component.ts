import { Component, OnInit } from '@angular/core';
import { SandboxService } from '../services/sandbox.service';
import { FlowService } from '../services/flow.service';
import { catchError, first, of } from 'rxjs';
import { FailureService } from '../services/failure.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-sandbox',
  templateUrl: './sandbox.component.html',
  styleUrl: './sandbox.component.scss'
})
export class SandboxComponent implements OnInit {
  showMoreHelp = false;
  sandboxId = 123;

  resources = ['sql', 'redis'];
  circuit: { [key: string] : string; }  = {};
  status: { [key: string]: string } = {};

 


  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sandboxService: SandboxService,
    private flowService: FlowService,
    private failureService: FailureService,
    
    )
     {
      this.resources.forEach(r =>{
        this.circuit[r] = 'operational';
        this.status[r] = '200 OK';
      })

     }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {

      //HACK: There should be a better way to solve Behva
      // if (!(this.route.queryParams as any).closeD)
      // {
      //   return 
      // }

      // this.sandboxId = params['sandboxId'];
      // if (!this.sandboxId){
      //   this.sandboxService.get()
      //     .pipe(
      //       first(), 
      //       catchError((e) =>
      //       {
      //        console.log(e)
      //        return of({});
      //       })
      //     )
      //     .subscribe((response: any) => {
          
      //       console.log(response.value);

      //       const sandboxId = response.value;

      //       if (sandboxId)
      //       {
      //         window.location.href = `/?sandboxId=${sandboxId}`;
      //       }

            
      //     })
      //   }
      //   else
      //   {
      //     //ready to use
      //    }

         console.log(this.sandboxId)
    });

  }


    test(resource: string)
    {
      this.flowService.execute(resource).pipe(
        first(),

      ).subscribe(output => {

        this.status[resource] = output;
      });
    }

     toggle(resource: string){
      switch(this.circuit[resource])
      {
        case 'operational':
          this.failureService.eject(resource);
          this.circuit[resource] ='unavailable';
          break;
        case 'unavallable':
        default:
          this.failureService.inject(resource);
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
