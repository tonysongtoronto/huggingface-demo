import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// 提供静态文件（前端界面）
app.use(express.static('public'));
app.use(express.json());

const HF_API_KEY = process.env.HF_API_KEY;
const HF_API_URL = "https://router.huggingface.co/v1/chat/completions";

// 经过测试可用的模型列表
const AVAILABLE_MODELS = {
  "llama": "meta-llama/Llama-3.3-70B-Instruct",
  "gemma": "google/gemma-2-9b-it",
  "qwen": "Qwen/Qwen2.5-72B-Instruct",
  "deepseek": "deepseek-ai/DeepSeek-V3",
  "mixtral": "mistralai/Mixtral-8x7B-Instruct-v0.1",
   "openai":"openai/gpt-oss-120b:groq"
};

const DEFAULT_MODEL = AVAILABLE_MODELS.llama;

/**
 * 调用 HuggingFace API
 */
async function callHuggingFace(messages, model = DEFAULT_MODEL) {
  try {
    console.log(`调用模型: ${model}`);
    
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

    console.log(`响应状态: ${response.status} ${response.statusText}`);

    const textResponse = await response.text();
    console.log(`响应内容 (前200字符): ${textResponse.substring(0, 200)}`);

    let data;
    try {
      data = JSON.parse(textResponse);
    } catch (parseError) {
      console.error("JSON 解析失败:", textResponse);
      throw new Error(`API 返回了无效的 JSON: ${textResponse.substring(0, 200)}`);
    }

    if (data.error) {
      const errorMsg = typeof data.error === 'string' 
        ? data.error 
        : JSON.stringify(data.error);
      console.error("API 返回错误:", errorMsg);
      throw new Error(errorMsg);
    }

    if (!data.choices || !data.choices[0]) {
      console.error("响应格式无效:", JSON.stringify(data));
      throw new Error("API 响应格式不正确");
    }

    return {
      content: data.choices[0].message.content,
      model: model,
      usage: data.usage
    };

  } catch (error) {
    console.error("HuggingFace API 完整错误:", error);
    throw error;
  }
}

/**
 * POST /chat - 聊天接口
 */
app.post("/chat", async (req, res) => {
  try {
    const { message, model } = req.body;

    if (!message) {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    const selectedModel = model && AVAILABLE_MODELS[model] 
      ? AVAILABLE_MODELS[model] 
      : DEFAULT_MODEL;

    console.log(`[${new Date().toISOString()}] 收到请求: "${message}"`);
    console.log(`使用模型: ${selectedModel}`);

    const result = await callHuggingFace([
      { role: "user", content: message }
    ], selectedModel);

    console.log(`[${new Date().toISOString()}] 响应生成成功`);

      console.log('*************************');

     console.log(result);
        console.log('*************************');

    res.json({
      reply: result.content,
      model: result.model,
      usage: result.usage
    });

  } catch (error) {
    console.error("聊天错误:", error.message);
    console.error("完整错误对象:", error);
    
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
      error: "生成响应失败",
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