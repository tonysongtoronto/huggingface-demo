import { ChatSession } from '../models/Session.js';
import logger from '../../logger.js';

class SessionService {
  // 注意：不再需要 constructor 中的定时器和 Map

  // 获取或创建会话 (Async)
  async getOrCreateSession(sessionId) {
    let session = await ChatSession.findOne({ sessionId });
    
    if (!session) {
      session = new ChatSession({ sessionId });
      await session.save();
      logger.info('创建新会话 (DB)', { sessionId });
    } else {
      // 访问时刷新时间
      session.lastAccessedAt = Date.now();
      await session.save();
    }
    
    return session;
  }

  // 获取会话 (Async)
  async getSession(sessionId) {
    return await ChatSession.findOne({ sessionId });
  }

  // 删除会话 (Async)
  async deleteSession(sessionId) {
    const result = await ChatSession.findOneAndDelete({ sessionId });
    if (result) {
      logger.info('销毁会话 (DB)', { sessionId });
    }
    return !!result;
  }

  // 获取所有会话列表 (Async)
  // 注意：生产环境如果数据量大，这里应该做分页
  async getAllSessions() {
    const sessions = await ChatSession.find({}, { 
      sessionId: 1, 
      'metadata.messageCount': 1, 
      'metadata.totalTokens': 1, 
      createdAt: 1, 
      lastAccessedAt: 1 
    }).lean(); // .lean() 提高查询性能，返回纯 JS 对象

    return sessions.map(s => ({
      sessionId: s.sessionId,
      messageCount: s.metadata?.messageCount || 0,
      totalTokens: s.metadata?.totalTokens || 0,
      createdAt: s.createdAt,
      lastAccessedAt: s.lastAccessedAt
    }));
  }

  // 获取会话总数 (Async)
  async getSessionCount() {
    return await ChatSession.countDocuments();
  }
  
  // 原有的 cleanupExpiredSessions 已被 MongoDB TTL 索引取代，无需代码实现
}

export default new SessionService();