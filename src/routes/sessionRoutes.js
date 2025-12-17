import express from 'express';
import sessionService from '../services/sessionService.js';
import huggingfaceService from '../services/huggingfaceService.js';
import { config } from '../config/config.js';
import logger from '../../logger.js';

const router = express.Router();

/**
 * POST /session/chat - 带会话的聊天
 */
router.post("/chat", async (req, res) => {
  const requestId = `session_${Date.now()}`;
  
  try {
    const { sessionId, message, model } = req.body;

    if (!sessionId) {
      logger.warn('缺少会话ID', { requestId });
      return res.status(400).json({
        error: "sessionId is required"
      });
    }

    if (!message) {
      logger.warn('收到空消息请求', { requestId, sessionId });
      return res.status(400).json({
        error: "message is required"
      });
    }

    const session = sessionService.getOrCreateSession(sessionId);
    session.addMessage("user", message);

    logger.info('处理会话聊天请求', { 
      requestId,
      sessionId,
      model: model || 'default',
      historyLength: session.messages.length 
    });

    const messages = session.getMessages();
    const result = await huggingfaceService.chat(messages, model);

    session.addMessage("assistant", result.content, result.usage);

    logger.info('会话聊天请求处理成功', { 
      requestId,
      sessionId,
      totalMessages: session.messages.length 
    });

    res.json({
      reply: result.content,
      model: result.model,
      usage: result.usage,
      session: {
        sessionId: session.sessionId,
        messageCount: session.metadata.messageCount,
        totalTokens: session.metadata.totalTokens
      }
    });

  } catch (error) {
    logger.error('会话聊天请求失败', { 
      requestId,
      error: error.message,
      stack: error.stack 
    });
    
    res.status(500).json({
      error: "生成响应失败",
      details: error.message
    });
  }
});

/**
 * GET /session/:sessionId - 获取会话历史
 */
router.get("/:sessionId", (req, res) => {
  const { sessionId } = req.params;

  const session = sessionService.getSession(sessionId);
  if (!session) {
    logger.warn('会话不存在', { sessionId });
    return res.status(404).json({
      error: "Session not found"
    });
  }

  logger.info('获取会话历史', { 
    sessionId,
    messageCount: session.messages.length 
  });

  res.json(session.toJSON());
});

/**
 * DELETE /session/:sessionId - 清空会话历史
 */
router.delete("/:sessionId", (req, res) => {
  const { sessionId } = req.params;

  const session = sessionService.getSession(sessionId);
  if (!session) {
    logger.warn('会话不存在', { sessionId });
    return res.status(404).json({
      error: "Session not found"
    });
  }

  session.clearHistory();
  logger.info('清空会话历史', { sessionId });

  res.json({
    message: "Session history cleared",
    sessionId: sessionId
  });
});

/**
 * DELETE /session/:sessionId/destroy - 销毁会话
 */
router.delete("/:sessionId/destroy", (req, res) => {
  const { sessionId } = req.params;

  const deleted = sessionService.deleteSession(sessionId);
  if (!deleted) {
    logger.warn('会话不存在', { sessionId });
    return res.status(404).json({
      error: "Session not found"
    });
  }

  res.json({
    message: "Session destroyed",
    sessionId: sessionId
  });
});

/**
 * GET /sessions - 获取所有活跃会话
 */
router.get("/", (req, res) => {
  const sessionList = sessionService.getAllSessions();

  logger.info('获取会话列表', { count: sessionList.length });

  res.json({
    sessions: sessionList,
    totalSessions: sessionList.length,
    config: {
      maxMessagesPerSession: config.session.maxMessagesPerSession,
      sessionTimeout: config.session.sessionTimeout
    }
  });
});

export default router;