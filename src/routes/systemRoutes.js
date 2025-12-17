import express from 'express';
import huggingfaceService from '../services/huggingfaceService.js';
import sessionService from '../services/sessionService.js';
import { config } from '../config/config.js';
import logger from '../../logger.js';

const router = express.Router();

/**
 * GET /models - 获取可用模型
 */
router.get("/models", (req, res) => {
  logger.info('获取模型列表');
  res.json(huggingfaceService.getAvailableModels());
});

/**
 * GET /health - 健康检查
 */
router.get("/health", (req, res) => {
  const healthStatus = {
    status: "ok",
    timestamp: new Date().toISOString(),
    api_key_configured: !!config.huggingface.apiKey,
    activeSessions: sessionService.getSessionCount()
  };
  
  logger.debug('健康检查', healthStatus);
  res.json(healthStatus);
});

/**
 * GET /api - API 信息
 */
router.get("/api", (req, res) => {
  res.json({
    message: "HuggingFace Chat API Server with Session Management",
    version: "2.0.0",
    endpoints: {
      "POST /chat": "Send a single message (no session)",
      "POST /session/chat": "Send message with session management",
      "GET /session/:sessionId": "Get session history",
      "DELETE /session/:sessionId": "Clear session history",
      "DELETE /session/:sessionId/destroy": "Destroy session",
      "GET /sessions": "List all active sessions",
      "POST /chat/stream": "Send multiple messages (no session)",
      "GET /models": "Get available models",
      "GET /health": "Health check"
    }
  });
});

export default router;