import { Injectable } from '@angular/core';
import { HttpClient} from '@angular/common/http'
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment.development';

@Injectable({
  providedIn: 'root'
})
export class SandboxService {
  constructor(private httpClient: HttpClient) { }

  get() : Observable<string>{
    return this.httpClient.post<string>(`${environment.apiUri}/sandbox`, {});
  }

}
