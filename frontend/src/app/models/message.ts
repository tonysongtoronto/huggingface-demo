// src/app/models/message.ts
export interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  avatar: string;
}

export interface ChatSession {
  sessionId: string;
  createdAt: string | Date;  // ✅ 修改这里
  lastAccessedAt: string | Date;  // ✅ 修改这里
  metadata: {
    messageCount: number;
    totalTokens: number;
  };
}

export interface StreamResponse {
  token?: string;
  done?: boolean;
}

export interface ChatRequest {
  sessionId: string;
  message: string;
  model: string;
}
