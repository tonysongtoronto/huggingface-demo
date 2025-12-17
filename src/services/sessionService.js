import { ChatSession } from '../models/Session.js';
import { config } from '../config/config.js';
import logger from '../../logger.js';

class SessionService {
  constructor() {
    this.sessions = new Map();
    this.startCleanupTimer();
  }

  getOrCreateSession(sessionId) {
    if (!this.sessions.has(sessionId)) {
      const session = new ChatSession(sessionId);
      this.sessions.set(sessionId, session);
      logger.info('创建新会话', { sessionId });
    }
    return this.sessions.get(sessionId);
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  deleteSession(sessionId) {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      logger.info('销毁会话', { sessionId });
    }
    return deleted;
  }

  getAllSessions() {
    return Array.from(this.sessions.values()).map(session => ({
      sessionId: session.sessionId,
      messageCount: session.metadata.messageCount,
      totalTokens: session.metadata.totalTokens,
      createdAt: session.createdAt,
      lastAccessedAt: session.lastAccessedAt
    }));
  }

  cleanupExpiredSessions() {
    let cleanedCount = 0;
    const timeout = config.session.sessionTimeout;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.isExpired(timeout)) {
        this.sessions.delete(sessionId);
        cleanedCount++;
        logger.info('清理过期会话', { sessionId });
      }
    }

    if (cleanedCount > 0) {
      logger.info('会话清理完成', { 
        cleanedCount, 
        remainingSessions: this.sessions.size 
      });
    }
  }

  startCleanupTimer() {
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, config.session.cleanupInterval);
  }

  getSessionCount() {
    return this.sessions.size;
  }
}

export default new SessionService();