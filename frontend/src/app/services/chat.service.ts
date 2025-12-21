// src/app/services/chat.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { ChatSession, ChatRequest } from '../models/message';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = environment.chatApiUrl;
  private streamSubject = new Subject<string>();

  constructor(private http: HttpClient) {}

  // 流式发送消息
  async sendMessageStream(request: ChatRequest): Promise<Observable<string>> {
    const response = await fetch(`${this.apiUrl}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error('服务器响应异常');
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const subject = new Subject<string>();

    this.processStream(reader, decoder, subject);

    return subject.asObservable();
  }

  private async processStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: TextDecoder,
    subject: Subject<string>
  ): Promise<void> {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          subject.complete();
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') continue;

            try {
              const data = JSON.parse(dataStr);
              if (data.token) {
                subject.next(data.token);
              }
            } catch (e) {
              console.error('解析数据失败:', e);
            }
          }
        }
      }
    } catch (error) {
      subject.error(error);
    }
  }

  // 获取会话信息
  getSession(sessionId: string): Observable<ChatSession> {
    return this.http.get<ChatSession>(`${this.apiUrl}/session/${sessionId}`);
  }

  // 删除会话
  deleteSession(sessionId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/session/${sessionId}`);
  }
}
