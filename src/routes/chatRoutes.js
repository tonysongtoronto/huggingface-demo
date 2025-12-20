import express from 'express';
import sessionService from '../services/sessionService.js';
import huggingfaceService from '../services/huggingfaceService.js';
import { config } from '../config/config.js';
import logger from '../../logger.js';

const router = express.Router();

/**
 * 辅助函数：统一提取聊天上下文
 * 逻辑：如果带 sessionId 则走 SessionService，否则视为单次/临时对话
 */
const prepareContext = (req) => {
  const { message, messages, sessionId } = req.body;
  let chatMessages = [];
  let sessionInstance = null;

  if (sessionId) {
    // 模式 A: 持久化会话
    sessionInstance = sessionService.getOrCreateSession(sessionId);
    if (message) {
      sessionInstance.addMessage("user", message);
    }
    chatMessages = sessionInstance.getMessages();
  } else {
    // 模式 B: 无状态/临时对话
    chatMessages = messages || (message ? [{ role: "user", content: message }] : []);
  }

  return { chatMessages, sessionInstance };
};

// ==========================================
// 1. 聊天核心接口 (Chat Endpoints)
// ==========================================

/**
 * POST /chat - 普通 JSON 对话
 */
router.post("/", async (req, res) => {
  const requestId = `chat_${Date.now()}`;
  try {
    const { model } = req.body;
    const { chatMessages, sessionInstance } = prepareContext(req);

    if (chatMessages.length === 0) {
      return res.status(400).json({ error: "Message is required" });
    }

    const result = await huggingfaceService.chat(chatMessages, model);

    // 如果是会话模式，保存 AI 回复
    if (sessionInstance) {
      sessionInstance.addMessage("assistant", result.content, result.usage);
    }

    res.json({
      reply: result.content,
      model: result.model,
      usage: result.usage,
      ...(sessionInstance && { 
        session: { 
          sessionId: sessionInstance.sessionId,
          messageCount: sessionInstance.metadata.messageCount 
        } 
      })
    });
  } catch (error) {
    logger.error('普通对话请求失败', { requestId, error: error.message });
    res.status(500).json({ error: "生成响应失败", details: error.message });
  }
});

/**
 * POST /chat/stream - 流式对话响应
 */
router.post("/stream", async (req, res) => {
  const requestId = `stream_${Date.now()}`;
  const { model } = req.body;

  try {
    const { chatMessages, sessionInstance } = prepareContext(req);

    if (chatMessages.length === 0) {
      return res.status(400).json({ error: "Message is required" });
    }

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let fullReply = "";

    // 调用 Service 的流式方法
    await huggingfaceService.chatStream(chatMessages, model, (token) => {
      fullReply += token;
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    });

    // 流结束后的处理
    if (sessionInstance) {
      sessionInstance.addMessage("assistant", fullReply);
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    logger.error('流式对话请求失败', { requestId, error: error.message });
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

// ==========================================
// 2. 会话管理接口 (Session Management)
// ==========================================

/**
 * GET /chat/sessions - 获取所有活跃会话列表
 */
router.get("/sessions", (req, res) => {
  const sessionList = sessionService.getAllSessions();
  logger.info('获取会话列表', { count: sessionList.length });

  res.json({
    sessions: sessionList,
    totalSessions: sessionList.length,
    config: {
      maxMessagesPerSession: config.session?.maxMessagesPerSession,
      sessionTimeout: config.session?.sessionTimeout
    }
  });
});

/**
 * GET /chat/session/:sessionId - 获取特定会话的历史记录
 */
router.get("/session/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const session = sessionService.getSession(sessionId);

  if (!session) {
    logger.warn('会话不存在', { sessionId });
    return res.status(404).json({ error: "Session not found" });
  }

  res.json(session.toJSON());
});

/**
 * DELETE /chat/session/:sessionId - 清空会话历史 (保留会话 ID)
 */
router.delete("/session/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const session = sessionService.getSession(sessionId);

  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  session.clearHistory();
  logger.info('清空会话历史', { sessionId });
  res.json({ message: "Session history cleared", sessionId });
});

/**
 * DELETE /chat/session/:sessionId/destroy - 彻底销毁会话
 */
router.delete("/session/:sessionId/destroy", (req, res) => {
  const { sessionId } = req.params;
  const deleted = sessionService.deleteSession(sessionId);

  if (!deleted) {
    return res.status(404).json({ error: "Session not found" });
  }

  logger.info('会话销毁成功', { sessionId });
  res.json({ message: "Session destroyed", sessionId });
});

export default router;