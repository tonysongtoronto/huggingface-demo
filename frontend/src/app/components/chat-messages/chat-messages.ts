// src/app/components/chat-messages/chat-messages.component.ts
import { Component, Input, AfterViewChecked, ElementRef, ViewChild } from '@angular/core';
import { Message } from '../../models/message';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-chat-messages',
  templateUrl: './chat-messages.html',
  imports: [CommonModule], // <--- 2. Add it here

  styleUrl: './chat-messages.scss'
})
export class ChatMessagesComponent implements AfterViewChecked {
  @Input() messages: Message[] = [];
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      this.messagesContainer.nativeElement.scrollTop =
        this.messagesContainer.nativeElement.scrollHeight;
    } catch (err) {}
  }

  formatTime(date: Date): string {
    return new Date(date).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
