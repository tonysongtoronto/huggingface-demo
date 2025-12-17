import express from 'express';
import huggingfaceService from '../services/huggingfaceService.js';
import logger from '../../logger.js';

const router = express.Router();

/**
 * POST /chat - 单次聊天（无会话）
 */
router.post("/", async (req, res) => {
  const requestId = `chat_${Date.now()}`;
  
  try {
    const { message, model } = req.body;

    if (!message) {
      logger.warn('收到空消息请求', { requestId });
      return res.status(400).json({
        error: "Message is required"
      });
    }

    logger.info('处理聊天请求', { 
      requestId,
      model: model || 'default',
      messageLength: message.length 
    });

    const result = await huggingfaceService.chat([
      { role: "user", content: message }
    ], model);

    logger.info('聊天请求处理成功', { 
      requestId,
      responseLength: result.content.length 
    });

    res.json({
      reply: result.content,
      model: result.model,
      usage: result.usage
    });

  } catch (error) {
    logger.error('聊天请求失败', { 
      requestId,
      error: error.message,
      stack: error.stack 
    });
    
    res.status(500).json({
      error: "生成响应失败",
      details: error.message,
      suggestion: "请尝试使用 Llama 或 Gemma 模型，或检查 API Key 是否有效"
    });
  }
});

/**
 * POST /chat/stream - 多轮对话（无会话管理）
 */
router.post("/stream", async (req, res) => {
  const requestId = `stream_${Date.now()}`;
  
  try {
    const { messages, model } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      logger.warn('收到无效的消息数组', { requestId });
      return res.status(400).json({
        error: "Messages array is required"
      });
    }

    logger.info('处理多轮对话请求', { 
      requestId,
      model: model || 'default',
      messageCount: messages.length 
    });

    const result = await huggingfaceService.chat(messages, model);

    logger.info('多轮对话请求处理成功', { requestId });

    res.json({
      reply: result.content,
      model: result.model,
      usage: result.usage
    });

  } catch (error) {
    logger.error('多轮对话请求失败', { 
      requestId,
      error: error.message 
    });
    
    res.status(500).json({
      error: "生成响应失败",
      details: error.message
    });
  }
});

export default router;