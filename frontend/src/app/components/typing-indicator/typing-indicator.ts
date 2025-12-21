// src/app/components/typing-indicator/typing-indicator.component.ts
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-typing-indicator',
  template: `
    <div class="typing-indicator" [class.active]="isActive">
      <div class="message-avatar">🤖</div>
      <div class="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  `,
 styleUrls: ['./typing-indicator.scss']
})
export class TypingIndicatorComponent {
  @Input() isActive = false;
}
