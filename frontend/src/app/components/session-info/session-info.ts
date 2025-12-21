// src/app/components/session-info/session-info.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { ChatSession } from '../../models/message';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-session-info',
  templateUrl: './session-info.html',
styleUrl: './session-info.scss',
 imports: [ CommonModule],
})
export class SessionInfoComponent {
  @Input() sessionInfo: ChatSession | null = null;
  @Output() close = new EventEmitter<void>();

  onClose(): void {
    this.close.emit();
  }

  formatDate(date: string | Date): string {
    return new Date(date).toLocaleString('zh-CN');
  }
}
