// src/app/components/chat-header/chat-header.component.ts
import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-chat-header',
  templateUrl: './chat-header.html',
  styleUrls: ['./chat-header.scss'],
  imports: [ CommonModule],
})
export class ChatHeaderComponent {
  @Input() messageCount = 0;
  @Input() models: Array<{value: string, label: string}> = [];
  @Input() selectedModel = 'llama';

  @Output() modelChange = new EventEmitter<string>();
  @Output() clearChat = new EventEmitter<void>();
  @Output() toggleInfo = new EventEmitter<void>();

  onModelChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.modelChange.emit(select.value);
  }

  onClearClick(): void {
    this.clearChat.emit();
  }

  onInfoClick(): void {
    this.toggleInfo.emit();
  }
}
