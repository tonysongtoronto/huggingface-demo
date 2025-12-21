import dotenv from "dotenv";

dotenv.config();

export const config = {
  // 服务器配置
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // HuggingFace API 配置
  huggingface: {
    apiKey: process.env.HF_API_KEY,
    apiUrl: "https://router.huggingface.co/v1/chat/completions",
    models: {
      "llama": "meta-llama/Llama-3.3-70B-Instruct",
      "gemma": "google/gemma-2-9b-it",
      "qwen": "Qwen/Qwen2.5-72B-Instruct",
      "deepseek": "deepseek-ai/DeepSeek-V3",
      "mixtral": "mistralai/Mixtral-8x7B-Instruct-v0.1",
      "openai": "openai/gpt-oss-120b:groq"
    },
    defaultModel: "llama",
    maxTokens: 500,
    temperature: 0.7
  },

  // 会话配置
  session: {
    maxMessagesPerSession: 50,
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 小时
    cleanupInterval: 60 * 60 * 1000 // 1 小时
  },
   mongoUri: process.env.MONGO_URI,
  mongoDbName: process.env.MONGO_DB_NAME
};