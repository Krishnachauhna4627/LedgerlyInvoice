import { Pipe, PipeTransform } from '@angular/core';
import { formatTime } from '../../core/ui/dates';

// {{ entry.createdAt | time }} → '9:49 AM' (local time); '' when there is no timestamp.
// {{ entry.createdAt | time: ', ' }} puts the prefix in front only when there is a time.
@Pipe({ name: 'time' })
export class TimePipe implements PipeTransform {
  transform(iso: string | null | undefined, prefix = ''): string {
    const time = formatTime(iso);
    return time ? prefix + time : '';
  }
}
