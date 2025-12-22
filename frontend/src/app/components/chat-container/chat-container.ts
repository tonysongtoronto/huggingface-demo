// src/app/components/chat-container/chat-container.component.ts
import { Component, OnInit } from '@angular/core';
import { ChatService } from '../../services/chat.service';
import { SessionService } from '../../services/session.service';
import { Message, ChatSession } from '../../models/message';
import { ChatHeaderComponent } from "../chat-header/chat-header";
import {  SessionInfoComponent } from "../session-info/session-info";
import { ChatMessagesComponent } from "../chat-messages/chat-messages";
import { ChatInputComponent } from "../chat-input/chat-input";
import { TypingIndicatorComponent } from "../typing-indicator/typing-indicator";
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-chat-container',
  standalone: true, // 必须添加这一行
  templateUrl: './chat-container.html',
  styleUrl: './chat-container.scss',
  imports: [ChatHeaderComponent, CommonModule,    SessionInfoComponent, ChatMessagesComponent, ChatInputComponent, TypingIndicatorComponent]
})


export class ChatContainerComponent implements OnInit {

  messages: Message[] = [];
  isTyping = false;
  selectedModel = 'llama';
  messageCount = 0;
  errorMessage = '';
  showSessionInfo = false;
  sessionInfo: ChatSession | null = null;

  models = [
    { value: 'llama', label: 'Llama 3.3 70B' },
    { value: 'gemma', label: 'Gemma 2 9B' },
    { value: 'qwen', label: 'Qwen 2.5 72B' },
    { value: 'deepseek', label: 'DeepSeek V3' },
    { value: 'mixtral', label: 'Mixtral 8x7B' },
    { value: 'openai', label: 'GPT OSS 120B' }
  ];

  constructor(
    private chatService: ChatService,
    private sessionService: SessionService
  ) {}

  ngOnInit(): void {
    this.addWelcomeMessage();
    this.updateSessionInfo();
  }

  private addWelcomeMessage(): void {

    this.messages.push({
      id: `msg_${Date.now()}`,
      content: '你好！会话模式已开启，我会记住我们的聊天历史。请问有什么可以帮您？',
      isUser: false,
      timestamp: new Date(),
      avatar: '🤖'
    });
  }

  async onSendMessage(text: string): Promise<void> {
    if (!text.trim()) return;

    // 添加用户消息
    this.messages.push({
      id: `msg_${Date.now()}`,
      content: text,
      isUser: true,
      timestamp: new Date(),
      avatar: '👤'
    });

    this.isTyping = true;

    // 创建 AI 消息占位符
    const aiMessage: Message = {
      id: `msg_${Date.now()}_ai`,
      content: '',
      isUser: false,
      timestamp: new Date(),
      avatar: '🤖'
    };
    this.messages.push(aiMessage);

    try {
      const stream = await this.chatService.sendMessageStream({
        sessionId: this.sessionService.getSessionId(),
        message: text,
        model: this.selectedModel
      });

      stream.subscribe({
        next: (token) => {
          aiMessage.content += token;
        },
        error: (err) => {
          this.showError(err.message || '连接中断');
          aiMessage.content = '抱歉，连接中断了。';
          this.isTyping = false;
        },
        complete: () => {
          this.isTyping = false;
          this.updateSessionInfo();
        }
      });
    } catch (error: any) {
      this.showError(error.message || '发送失败');
      this.isTyping = false;
    }
  }

  async toggleSessionInfo(): Promise<void> {

    
    if (this.showSessionInfo) {
      this.showSessionInfo = false;
      return;
    }

    try {
      this.chatService.getSession(this.sessionService.getSessionId())
        .subscribe({
          next: (data) => {
            this.sessionInfo = data;
            this.showSessionInfo = true;
          },
          error: (err) => {
            this.showError('获取详情失败');
          }
        });
    } catch (error) {
      this.showError('获取详情失败');
    }
  }

  async clearChat(): Promise<void> {
    if (!confirm('确定要清空上下文吗？AI 将不再记得之前的对话。')) {
      return;
    }

    this.chatService.deleteSession(this.sessionService.getSessionId())
      .subscribe({
        next: () => {
          this.messages = [];
          this.addWelcomeMessage();
          this.messages[0].content = '上下文已清除，开始新对话吧！';
          this.updateSessionInfo();
          this.showSessionInfo = false;
        },
        error: (err) => {
          this.showError('清空失败');
        }
      });
  }

  private updateSessionInfo(): void {
    this.chatService.getSession(this.sessionService.getSessionId())
      .subscribe({
        next: (data) => {
          this.messageCount = data.metadata?.messageCount || 0;
        },
        error: () => {}
      });
  }

  private showError(message: string): void {
    this.errorMessage = message;
    setTimeout(() => {
      this.errorMessage = '';
    }, 3000);
  }

  onModelChange(model: string): void {
    this.selectedModel = model;
  }
}
