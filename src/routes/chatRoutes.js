import express from 'express';
import sessionService from '../services/sessionService.js';
import huggingfaceService from '../services/huggingfaceService.js';
import { config } from '../config/config.js';
import logger from '../../logger.js';

const router = express.Router();

/**
 * 辅助函数：统一提取聊天上下文 (改为 Async)
 */
const prepareContext = async (req) => {
  const { message, messages, sessionId } = req.body;
  let chatMessages = [];
  let sessionInstance = null;

  if (sessionId) {
    // 模式 A: 持久化会话 (需 Await)
    sessionInstance = await sessionService.getOrCreateSession(sessionId);
    
    if (message) {
      // addMessage 现在是 async 的，会写入 DB
      await sessionInstance.addMessage("user", message);
    }
    
    // 获取上下文
    chatMessages = sessionInstance.getMessages();
    // 确保最后访问时间被保存
    await sessionInstance.save(); 
  } else {
    // 模式 B: 无状态/临时对话
    chatMessages = messages || (message ? [{ role: "user", content: message }] : []);
  }

  return { chatMessages, sessionInstance };
};

// ==========================================
// 1. 聊天核心接口
// ==========================================

router.post("/", async (req, res) => {
  const requestId = `chat_${Date.now()}`;
  try {
    const { model } = req.body;
    // 关键变更: await prepareContext
    const { chatMessages, sessionInstance } = await prepareContext(req);

    if (chatMessages.length === 0) {
      return res.status(400).json({ error: "Message is required" });
    }

    const result = await huggingfaceService.chat(chatMessages, model);

    if (sessionInstance) {
      // 关键变更: await addMessage
      await sessionInstance.addMessage("assistant", result.content, result.usage);
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

router.post("/stream", async (req, res) => {
  const requestId = `stream_${Date.now()}`;
  const { model } = req.body;

  try {
    // 关键变更: await prepareContext
    const { chatMessages, sessionInstance } = await prepareContext(req);

    if (chatMessages.length === 0) {
      return res.status(400).json({ error: "Message is required" });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let fullReply = "";

    await huggingfaceService.chatStream(chatMessages, model, (token) => {
      fullReply += token;
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    });

    if (sessionInstance) {
      // 关键变更: await addMessage
      await sessionInstance.addMessage("assistant", fullReply);
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    logger.error('流式对话请求失败', { requestId, error: error.message });
    // 如果流尚未开始发送数据，可以返回 JSON 错误，否则只能在流中报错
    if (!res.headersSent) {
        return res.status(500).json({ error: error.message });
    }
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

// ==========================================
// 2. 会话管理接口
// ==========================================

router.get("/sessions", async (req, res) => {
  // 关键变更: await
  const sessionList = await sessionService.getAllSessions();
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

router.get("/session/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  // 关键变更: await
  const session = await sessionService.getSession(sessionId);

  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  // Mongoose 对象直接转 JSON 即可
  res.json(session);
});

router.delete("/session/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  const session = await sessionService.getSession(sessionId);

  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  // 关键变更: await clearHistory
  await session.clearHistory();
  logger.info('清空会话历史', { sessionId });
  res.json({ message: "Session history cleared", sessionId });
});

router.delete("/session/:sessionId/destroy", async (req, res) => {
  const { sessionId } = req.params;
  // 关键变更: await
  const deleted = await sessionService.deleteSession(sessionId);

  if (!deleted) {
    return res.status(404).json({ error: "Session not found" });
  }

  logger.info('会话销毁成功', { sessionId });
  res.json({ message: "Session destroyed", sessionId });
});

export default router;