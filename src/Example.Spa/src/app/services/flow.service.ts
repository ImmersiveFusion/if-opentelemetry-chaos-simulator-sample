import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FlowService {

  constructor() { }

  run(resource: string): Observable<string> {
    return of(Date().toString() + ' - 200 OK mary had a little lamb and its coat aws mate of candy and other worthless nonsense omg wtf is this');
  }
}
