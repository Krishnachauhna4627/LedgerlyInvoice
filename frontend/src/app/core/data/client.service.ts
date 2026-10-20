import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Client, ClientInput } from './models';

@Injectable({ providedIn: 'root' })
export class ClientService {
  private readonly http = inject(HttpClient);

  list(): Observable<Client[]> {
    return this.http.get<Client[]>('/api/clients');
  }

  create(input: ClientInput): Observable<Client> {
    return this.http.post<Client>('/api/clients', input);
  }

  update(id: number, input: ClientInput): Observable<Client> {
    return this.http.put<Client>(`/api/clients/${id}`, input);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`/api/clients/${id}`);
  }
}
