// src/app/app.component.ts
import { Component } from '@angular/core';
import { ChatContainerComponent } from "./components/chat-container/chat-container";

@Component({
  selector: 'app-root',
  template: '<app-chat-container></app-chat-container>',
  styles: [],
  imports: [ChatContainerComponent]
})
export class AppComponent {
  title = 'ai-chat-app';
}
