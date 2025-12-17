import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import morgan from "morgan";
import logger, { httpLogger } from "./logger.js";

dotenv.config();

const app = express();

// 提供静态文件（前端界面）
app.use(express.static('public'));
app.use(express.json());

// ==================== Morgan HTTP 请求日志 ====================

// 自定义 Morgan token - 记录请求体
morgan.token('body', (req) => {
  if (req.body && Object.keys(req.body).length > 0) {
    // 隐藏敏感信息
    const sanitized = { ...req.body };
    if (sanitized.message && sanitized.message.length > 100) {
      sanitized.message = sanitized.message.substring(0, 100) + '...';
    }
    return JSON.stringify(sanitized);
  }
  return '-';
});

// 自定义 Morgan token - 记录响应时间（毫秒）
morgan.token('response-time-ms', (req, res) => {
  if (!req._startAt || !res._startAt) return '-';
  const ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
    (res._startAt[1] - req._startAt[1]) * 1e-6;
  return ms.toFixed(3);
});

// Morgan 日志格式
const morganFormat = ':method :url :status :response-time-ms ms - :body';

// 使用 Morgan 中间件，将日志写入 Winston
app.use(morgan(morganFormat, {
  stream: {
    write: (message) => {
      httpLogger.info(message.trim());
    }
  }
}));

// ==================== 配置 ====================

const HF_API_KEY = process.env.HF_API_KEY;
const HF_API_URL = "https://router.huggingface.co/v1/chat/completions";

// 经过测试可用的模型列表
const AVAILABLE_MODELS = {
  "llama": "meta-llama/Llama-3.3-70B-Instruct",
  "gemma": "google/gemma-2-9b-it",
  "qwen": "Qwen/Qwen2.5-72B-Instruct",
  "deepseek": "deepseek-ai/DeepSeek-V3",
  "mixtral": "mistralai/Mixtral-8x7B-Instruct-v0.1",
  "openai": "openai/gpt-oss-120b:groq"
};

const DEFAULT_MODEL = AVAILABLE_MODELS.llama;

// ==================== 核心函数 ====================

/**
 * 调用 HuggingFace API
 */
async function callHuggingFace(messages, model = DEFAULT_MODEL) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    logger.info('开始调用 HuggingFace API', { 
      requestId, 
      model, 
      messageCount: messages.length 
    });
    
    const response = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: 500,
        temperature: 0.7
      })
    });

    logger.info('收到 HuggingFace API 响应', { 
      requestId,
      status: response.status, 
      statusText: response.statusText 
    });

    const textResponse = await response.text();
    
    let data;
    try {
      data = JSON.parse(textResponse);
    } catch (parseError) {
      logger.error('JSON 解析失败', { 
        requestId,
        error: parseError.message,
        responsePreview: textResponse.substring(0, 200) 
      });
      throw new Error(`API 返回了无效的 JSON: ${textResponse.substring(0, 200)}`);
    }

    if (data.error) {
      const errorMsg = typeof data.error === 'string' 
        ? data.error 
        : JSON.stringify(data.error);
      
      logger.error('HuggingFace API 返回错误', { 
        requestId,
        model,
        error: errorMsg 
      });
      throw new Error(errorMsg);
    }

    if (!data.choices || !data.choices[0]) {
      logger.error('API 响应格式无效', { 
        requestId,
        response: JSON.stringify(data) 
      });
      throw new Error("API 响应格式不正确");
    }

    logger.info('API 调用成功', { 
      requestId,
      model,
      tokensUsed: data.usage 
    });

    return {
      content: data.choices[0].message.content,
      model: model,
      usage: data.usage
    };

  } catch (error) {
    logger.error('HuggingFace API 调用失败', { 
      requestId,
      model,
      error: error.message,
      stack: error.stack 
    });
    throw error;
  }
}

// ==================== 路由 ====================

/**
 * POST /chat - 聊天接口
 */
app.post("/chat", async (req, res) => {
  const requestId = `chat_${Date.now()}`;
  
  try {
    const { message, model } = req.body;

    if (!message) {
      logger.warn('收到空消息请求', { requestId });
      return res.status(400).json({
        error: "Message is required"
      });
    }

    const selectedModel = model && AVAILABLE_MODELS[model] 
      ? AVAILABLE_MODELS[model] 
      : DEFAULT_MODEL;

    logger.info('处理聊天请求', { 
      requestId,
      model: selectedModel,
      messageLength: message.length 
    });

    const result = await callHuggingFace([
      { role: "user", content: message }
    ], selectedModel);

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
 * POST /chat/stream - 流式聊天接口（多轮对话）
 */
app.post("/chat/stream", async (req, res) => {
  const requestId = `stream_${Date.now()}`;
  
  try {
    const { messages, model } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      logger.warn('收到无效的消息数组', { requestId });
      return res.status(400).json({
        error: "Messages array is required"
      });
    }

    const selectedModel = model && AVAILABLE_MODELS[model] 
      ? AVAILABLE_MODELS[model] 
      : DEFAULT_MODEL;

    logger.info('处理多轮对话请求', { 
      requestId,
      model: selectedModel,
      messageCount: messages.length 
    });

    const result = await callHuggingFace(messages, selectedModel);

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

/**
 * GET /models - 获取可用模型列表
 */
app.get("/models", (req, res) => {
  logger.info('获取模型列表');
  res.json({
    available_models: Object.keys(AVAILABLE_MODELS),
    default_model: "llama",
    models: AVAILABLE_MODELS,
    verified: ["llama", "gemma"],
    note: "所有模型都需要有效的 HuggingFace API Key"
  });
});

/**
 * GET /health - 健康检查
 */
app.get("/health", (req, res) => {
  const healthStatus = {
    status: "ok",
    timestamp: new Date().toISOString(),
    api_key_configured: !!HF_API_KEY
  };
  
  logger.debug('健康检查', healthStatus);
  res.json(healthStatus);
});

/**
 * GET /api - API 信息
 */
app.get("/api", (req, res) => {
  res.json({
    message: "HuggingFace Chat API Server",
    endpoints: {
      "POST /chat": "Send a single message",
      "POST /chat/stream": "Send multiple messages (conversation)",
      "GET /models": "Get available models",
      "GET /health": "Health check"
    }
  });
});

// ==================== 错误处理中间件 ====================

// 404 处理
app.use((req, res) => {
  logger.warn('404 - 路由未找到', { 
    method: req.method, 
    path: req.path 
  });
  res.status(404).json({ 
    error: "Not Found",
    path: req.path 
  });
});

// 全局错误处理
app.use((err, req, res, next) => {
  logger.error('未捕获的错误', { 
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  res.status(500).json({ 
    error: "Internal Server Error",
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ==================== 启动服务器 ====================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info('服务器启动成功', { port: PORT });
  
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║       HuggingFace Chat API Server (With Logging)             ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");
  console.log(`\n✅ Server running on http://localhost:${PORT}`);
  console.log(`\n📝 Available endpoints:`);
  console.log(`   POST   http://localhost:${PORT}/chat`);
  console.log(`   POST   http://localhost:${PORT}/chat/stream`);
  console.log(`   GET    http://localhost:${PORT}/models`);
  console.log(`   GET    http://localhost:${PORT}/health`);
  console.log(`\n🔑 API Key: ${HF_API_KEY ? '已配置 ✓' : '未配置 ✗'}`);
  console.log(`\n📋 日志文件位置:`);
  console.log(`   - logs/combined.log (所有日志)`);
  console.log(`   - logs/error.log (错误日志)`);
  console.log(`   - logs/http.log (HTTP 请求日志)`);
  console.log(`\n按 Ctrl+C 停止服务器\n`);
});