// src/app/services/session.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private sessionIdKey = 'chat_session_id';
  private currentSessionId$ = new BehaviorSubject<string>(this.getOrCreateSessionId());

  constructor() {}

  // 获取或创建 SessionID
  private getOrCreateSessionId(): string {
    let sessionId = sessionStorage.getItem(this.sessionIdKey);
    if (!sessionId) {
      sessionId = `sess_${Date.now()}`;
      sessionStorage.setItem(this.sessionIdKey, sessionId);
    }
    return sessionId;
  }

  // 获取当前 SessionID
  getSessionId(): string {
    return this.currentSessionId$.value;
  }

  // 获取 SessionID 的 Observable
  getSessionId$() {
    return this.currentSessionId$.asObservable();
  }

  // 重置 Session
  resetSession(): void {
    const newSessionId = `sess_${Date.now()}`;
    sessionStorage.setItem(this.sessionIdKey, newSessionId);
    this.currentSessionId$.next(newSessionId);
  }
}
