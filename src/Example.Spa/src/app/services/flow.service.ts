import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment.development';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class FlowService {

  constructor(private httpClient: HttpClient) { }
  
  executeSql(sandboxId: string) : Observable<any>  {
   return this.httpClient.post<any>(`${environment.apiUri}/flow/execute/sql?sandboxId=${sandboxId}`, {});
  }
  executeRedis(sandboxId: string) : Observable<any>  {
    return this.httpClient.post<any>(`${environment.apiUri}/flow/execute/redis?sandboxId=${sandboxId}`, {});
  }
}
