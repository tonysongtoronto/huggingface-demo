export class ChatSession {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.messages = [];
    this.createdAt = Date.now();
    this.lastAccessedAt = Date.now();
    this.metadata = {
      messageCount: 0,
      totalTokens: 0
    };
  }

  addMessage(role, content, usage = null) {
    this.messages.push({
      role,
      content,
      timestamp: Date.now(),
      usage
    });

    this.metadata.messageCount++;
    if (usage && usage.total_tokens) {
      this.metadata.totalTokens += usage.total_tokens;
    }

    this.lastAccessedAt = Date.now();
  }

  getMessages() {
    this.lastAccessedAt = Date.now();
    return this.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  clearHistory() {
    this.messages = [];
    this.metadata.messageCount = 0;
    this.metadata.totalTokens = 0;
    this.lastAccessedAt = Date.now();
  }

  isExpired(timeout) {
    return Date.now() - this.lastAccessedAt > timeout;
  }

  toJSON() {
    return {
      sessionId: this.sessionId,
      messages: this.messages,
      createdAt: this.createdAt,
      lastAccessedAt: this.lastAccessedAt,
      metadata: this.metadata
    };
  }
}