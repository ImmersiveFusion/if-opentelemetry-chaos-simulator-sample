import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FlowService {

  constructor() { }

  execute(resource: string): Observable<string> {
    return of(Date().toString() + ' - 200 OK');
  }
}
