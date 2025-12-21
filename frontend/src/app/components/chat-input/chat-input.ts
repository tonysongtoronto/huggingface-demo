// src/app/components/chat-input/chat-input.component.ts
import { Component, Output, EventEmitter, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chat-input',
  templateUrl: './chat-input.html',
  imports: [FormsModule],
  styleUrl: './chat-input.scss'

})
export class ChatInputComponent {
  @Input() disabled = false;
  @Output() sendMessage = new EventEmitter<string>();

  inputText = '';

  onSend(): void {
    const text = this.inputText.trim();
    if (text && !this.disabled) {
      this.sendMessage.emit(text);
      this.inputText = '';
    }
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSend();
    }
  }
}
