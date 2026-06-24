import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export type MailItemStatus = 'sent' | 'failed';

export interface EmailBroadcastRequest {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  note: string;
  orgId?: string | number;
  recruiterId?: string;
  groupId?: number | string;
}

export interface BroadcastProgressEvent {
  kind: 'start' | 'item' | 'done' | 'error';
  recipient?: string;
  status?: MailItemStatus;
  message?: string;
  sent?: number;
  failed?: number;
  total?: number;
  percent?: number;
  jobId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class GroupService {
  [x: string]: any;
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient, private zone: NgZone) { }

  createGroup(req: any): Observable<any> {
    return this.http.post(`${this.apiUrl}group/createGroup`, req);
  }

  getGroupDetails(orgid: string, orgdiv: string, accessType: string ,recruiterId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}group/getGroups`, {
      params: { orgid, orgdiv, accessType, recruiterId }
    });
  }
getMailsentdtails(orgid: number, orgdiv: number, groupid: number): Observable<any> {
  return this.http.get(`${this.apiUrl}group/maildetails/${orgid}/${orgdiv}/${groupid}`);
}

  getCandidateFecthDetails(): Observable<any> {
    return this.http.get(`${this.apiUrl}group/getGroupMembers`);
  }

  updateGroupName(req: any): Observable<any> {
    return this.http.put(`${this.apiUrl}group/updateGroupName`, req)
  }

  deleteGroup(groupId: number): Observable<any> {
    return this.http.put(`${this.apiUrl}group/deleteGroupName/${groupId}`, {});
  }


  deleteCandidate(candidateId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}group/Candidatedelete/${candidateId}`);
  }

  startEmailBroadcastSSE(req: EmailBroadcastRequest): Observable<BroadcastProgressEvent> {
    return new Observable<BroadcastProgressEvent>((observer) => {
      let es: EventSource | null = null;

      this.http.post<{ jobId: string; total: number }>(`${this.apiUrl}group/email/start`, req)
        .subscribe({
          next: ({ jobId, total }) => {
            observer.next({ kind: 'start', sent: 0, failed: 0, total, percent: 0, jobId });

            const url = `${this.apiUrl}group/email/stream?jobId=${encodeURIComponent(jobId)}`;
            es = new EventSource(url, { withCredentials: true });

            es.onmessage = (evt) => {
              try {
                const data = JSON.parse(evt.data) as BroadcastProgressEvent;

                this.zone.run(() => observer.next(data));
              } catch (e) {
                this.zone.run(() => observer.next({ kind: 'error', message: 'Malformed event payload' }));
              }
            };
            es.onerror = () => {
              this.zone.run(() => {
                observer.next({ kind: 'error', message: 'Connection lost' });
                observer.complete();
              });
              if (es) es.close();
            };
          },
          error: (err) => {
            observer.next({ kind: 'error', message: err?.error?.message || 'Failed to start broadcast' });
            observer.complete();
          },
        });

      return () => {
        if (es) es.close();
      };
    });
  }


  startEmailBroadcastPolling(req: EmailBroadcastRequest): Observable<BroadcastProgressEvent> {
    return new Observable<BroadcastProgressEvent>((observer) => {
      let intervalId: any;

      this.http.post<{ jobId: string; total: number }>(`${this.apiUrl}group/email/start`, req)
        .subscribe({
          next: ({ jobId, total }) => {
            observer.next({ kind: 'start', sent: 0, failed: 0, total, percent: 0, jobId });

            const poll = () => {
              this.http.get<{ sent: number; failed: number; total: number; logs?: any[]; done?: boolean }>(
                `${this.apiUrl}group/email/status?jobId=${encodeURIComponent(jobId)}`
              ).subscribe({
                next: (s) => {
                  const percent = s.total ? Math.round(((s.sent + s.failed) / s.total) * 100) : 0;
                  observer.next({ kind: 'item', sent: s.sent, failed: s.failed, total: s.total, percent });
                  if (s.done || percent >= 100) {
                    observer.next({ kind: 'done', sent: s.sent, failed: s.failed, total: s.total, percent: 100 });
                    clearInterval(intervalId);
                    observer.complete();
                  }
                },
                error: (e) => {
                  observer.next({ kind: 'error', message: e?.error?.message || 'Polling failed' });
                  clearInterval(intervalId);
                  observer.complete();
                }
              });
            };

            poll();
            intervalId = setInterval(poll, 1200);
          },
          error: (e) => {
            observer.next({ kind: 'error', message: e?.error?.message || 'Failed to start broadcast' });
            observer.complete();
          }
        });

      return () => {
        if (intervalId) clearInterval(intervalId);
      };
    });
  }

  sendOneEmail(payload: {
    to: string; subject: string; note: string; cc?: string[]; bcc?: string[];
    orgId?: string | number; recruiterId?: string; groupId?: string | number;
  }) {
    return this.http.post<{ ok: boolean; messageId?: string }>(`${this.apiUrl}group/email/send`, payload);
  }


}
