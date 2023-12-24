import { Injectable } from '@angular/core';
import { HttpClient} from '@angular/common/http'

@Injectable({
  providedIn: 'root'
})
export class SandboxService {
  constructor(private httpClient: HttpClient) { }

  close(resource: string) {
   
  }
  open(resource: string) {
   
  }
}
