import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Item, ItemInput } from './models';

@Injectable({ providedIn: 'root' })
export class ItemService {
  private readonly http = inject(HttpClient);

  list(): Observable<Item[]> {
    return this.http.get<Item[]>('/api/items');
  }

  create(input: ItemInput): Observable<Item> {
    return this.http.post<Item>('/api/items', input);
  }

  update(id: number, input: ItemInput): Observable<Item> {
    return this.http.put<Item>(`/api/items/${id}`, input);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`/api/items/${id}`);
  }
}
