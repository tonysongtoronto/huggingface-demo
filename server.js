import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// 提供静态文件（前端界面）
app.use(express.static('public'));

const HF_API_KEY = process.env.HF_API_KEY;
const HF_API_URL = "https://router.huggingface.co/v1/chat/completions";

// 可用的免费模型列表
const AVAILABLE_MODELS = {
  "smollm": "HuggingFaceTB/SmolLM3-3B:hf-inference",
  "qwen": "Qwen/Qwen2.5-0.5B-Instruct:hf-inference",
  "llama": "meta-llama/Llama-3.2-1B-Instruct:together",
  "phi": "microsoft/Phi-3-mini-4k-instruct:together"
};

// 默认使用的模型
const DEFAULT_MODEL = AVAILABLE_MODELS.smollm;

/**
 * 调用 HuggingFace API
 */
async function callHuggingFace(messages, model = DEFAULT_MODEL) {
  try {
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

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    if (!data.choices || !data.choices[0]) {
      throw new Error("Invalid response format from HuggingFace API");
    }

    return {
      content: data.choices[0].message.content,
      model: model,
      usage: data.usage
    };

  } catch (error) {
    console.error("HuggingFace API Error:", error.message);
    throw error;
  }
}

/**
 * POST /chat - 聊天接口
 * Body: { message: string, model?: string }
 */
app.post("/chat", async (req, res) => {
  try {
    const { message, model } = req.body;

    // 验证输入
    if (!message) {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    // 选择模型
    const selectedModel = model && AVAILABLE_MODELS[model] 
      ? AVAILABLE_MODELS[model] 
      : DEFAULT_MODEL;

    console.log(`[${new Date().toISOString()}] 收到请求: "${message}"`);
    console.log(`使用模型: ${selectedModel}`);

    // 调用 HuggingFace API
    const result = await callHuggingFace([
      { role: "user", content: message }
    ], selectedModel);

    console.log(`[${new Date().toISOString()}] 响应生成成功`);

    // 返回结果
    res.json({
      reply: result.content,
      model: result.model,
      usage: result.usage
    });

  } catch (error) {
    console.error("Error:", error.message);
    
    res.status(500).json({
      error: "Failed to generate response",
      details: error.message
    });
  }
});

/**
 * POST /chat/stream - 流式聊天接口（多轮对话）
 * Body: { messages: [{role: string, content: string}], model?: string }
 */
app.post("/chat/stream", async (req, res) => {
  try {
    const { messages, model } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Messages array is required"
      });
    }

    const selectedModel = model && AVAILABLE_MODELS[model] 
      ? AVAILABLE_MODELS[model] 
      : DEFAULT_MODEL;

    console.log(`[${new Date().toISOString()}] 多轮对话请求`);
    console.log(`消息数量: ${messages.length}`);
    console.log(`使用模型: ${selectedModel}`);

    const result = await callHuggingFace(messages, selectedModel);

    res.json({
      reply: result.content,
      model: result.model,
      usage: result.usage
    });

  } catch (error) {
    console.error("Error:", error.message);
    
    res.status(500).json({
      error: "Failed to generate response",
      details: error.message
    });
  }
});

/**
 * GET /models - 获取可用模型列表
 */
app.get("/models", (req, res) => {
  res.json({
    available_models: Object.keys(AVAILABLE_MODELS),
    default_model: "smollm",
    models: AVAILABLE_MODELS
  });
});

/**
 * GET /health - 健康检查
 */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    api_key_configured: !!HF_API_KEY
  });
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

// 注意: GET / 会自动提供 public/index.html（由 express.static 处理）

// 启动服务器
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║       HuggingFace Chat API Server                            ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");
  console.log(`\n✅ Server running on http://localhost:${PORT}`);
  console.log(`\n📝 Available endpoints:`);
  console.log(`   POST   http://localhost:${PORT}/chat`);
  console.log(`   POST   http://localhost:${PORT}/chat/stream`);
  console.log(`   GET    http://localhost:${PORT}/models`);
  console.log(`   GET    http://localhost:${PORT}/health`);
  console.log(`\n🔑 API Key: ${HF_API_KEY ? '已配置 ✓' : '未配置 ✗'}`);
  console.log(`\n按 Ctrl+C 停止服务器\n`);
});