import { Pipe, PipeTransform } from '@angular/core';
@Pipe({name: 'rn2br'})
export class ReplaceLineBreaksPipe implements PipeTransform {
transform(value: string): string {
      return value.replace(/\\r\\n/g, '<br/>');
   }
}