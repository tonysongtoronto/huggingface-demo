import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import { pipeline, env } from "@huggingface/transformers";
import fs from "fs/promises";
import { AnswerPolicy } from "./files/answerPolicy.js";

dotenv.config();

// ===== 1️⃣ 配置模型 =====
env.allowLocalModels = true;
env.backends.onnx.wasm.numThreads = 4;
env.backends.onnx.wasm.simd = true;

const EMBEDDING_MODEL = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";

// 🔧 选择免费API (取消注释你想用的)

// 方案1: 硅基流动 (最推荐 - 中文最好,2000万tokens)
// const API_PROVIDER = "siliconflow";
// const API_KEY = process.env.SILICONFLOW_API_KEY;
// const API_URL = "https://api.siliconflow.cn/v1/chat/completions";
// const MODEL_NAME = "Qwen/Qwen2.5-7B-Instruct";

// 方案2: Groq (备选 - 速度快但中文一般)
const API_PROVIDER = "groq";
const API_KEY = process.env.GROQ_API_KEY;
const API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL_NAME = "llama-3.3-70b-versatile";

// 方案3: 智谱 GLM (备选 - 中文好,一次性500万tokens)
// const API_PROVIDER = "zhipu";
// const API_KEY = process.env.ZHIPU_API_KEY;
// const API_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
// const MODEL_NAME = "glm-4-flash";

const client = new MongoClient(process.env.MONGO_URI);
let embedderPromise = null;

// ===== 2️⃣ 单例模型加载 =====
function getEmbedder() {
  if (!embedderPromise) {
    console.log(`🚀 加载 Embedding 模型 (${EMBEDDING_MODEL})...`);
    embedderPromise = pipeline("feature-extraction", EMBEDDING_MODEL, {
      quantized: true
    });
  }
  return embedderPromise;
}

// ===== 3️⃣ 调用免费 API =====
async function callFreeAPI(prompt) {
  if (!API_KEY) {
    const instructions = {
      groq: "1. 访问 https://console.groq.com\n2. Google账号登录(免费)\n3. API Keys → Create API Key\n4. 在 .env 中设置 GROQ_API_KEY=your_key",
      deepseek: "1. 访问 https://platform.deepseek.com\n2. 邮箱注册(免费,无需绑卡)\n3. 控制台 → API Keys → 创建\n4. 在 .env 中设置 DEEPSEEK_API_KEY=your_key",
      siliconflow: "1. 访问 https://cloud.siliconflow.cn\n2. 微信扫码注册(免费)\n3. 控制台 → API 密钥 → 创建\n4. 在 .env 中设置 SILICONFLOW_API_KEY=your_key",
      zhipu: "1. 访问 https://open.bigmodel.cn\n2. 手机号注册(免费)\n3. 控制台 → API 密钥 → 创建\n4. 在 .env 中设置 ZHIPU_API_KEY=your_key"
    };
    
    throw new Error(
      `请先获取 ${API_PROVIDER} 的免费 API Key:\n${instructions[API_PROVIDER]}`
    );
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          { role: "user", content: prompt }
        ],
        max_tokens: 200,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API 错误 (${response.status}): ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
    
  } catch (error) {
    if (error.message.includes("fetch")) {
      throw new Error("网络连接失败,请检查网络");
    }
    throw error;
  }
}

// ===== 4️⃣ Embedding & Collection =====
async function getEmbedding(text) {
  const model = await getEmbedder();
  const output = await model(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

async function getCollection() {
  await client.connect();
  const db = client.db(process.env.MONGO_DB);
  return db.collection("documents");
}

// ===== 5️⃣ 向量检索 =====
async function searchVector(col, query, k = 3) {
  const qEmbedding = await getEmbedding(query);
  const cursor = col.aggregate([
    {
      $vectorSearch: {
        index: "vector_index",
        path: "embedding",
        queryVector: qEmbedding,
        numCandidates: 100,
        limit: k
      }
    },
    { $addFields: { score: { $meta: "vectorSearchScore" } } },
    { $project: { _id: 0, content: 1, score: 1 } }
  ]);
  return cursor.toArray();
}

// ===== 6️⃣ AnswerPolicy 实例 =====
const policy = new AnswerPolicy({
  highThreshold: 0.75,
  lowThreshold: 0.5
});

// ===== 7️⃣ RAG 核心函数 =====
async function ragAnswer(col, question) {
  const topDocs = await searchVector(col, question, 3);
  const decision = policy.decide(topDocs);
  const context = topDocs.map((d, i) => `资料${i + 1}: ${d.content}`).join("\n");

  let prompt;
  switch (decision.answer_type) {
    case "rag_strict":
      prompt = `请仅根据以下资料回答问题。如果资料中没有答案,回答"资料中未找到相关信息"。

资料:
${context}

问题: ${question}

要求: 用一句话简洁回答,不要编造信息。`;
      break;

    case "rag_hybrid":
      prompt = `请根据以下资料和你的知识回答问题。优先使用资料内容。

资料:
${context}

问题: ${question}

要求: 用一句话简洁回答。`;
      break;

    case "llm_only":
      prompt = `请用一句话简洁回答以下问题:

${question}`;
      break;

    default:
      prompt = question;
  }

  console.log("📝 Prompt 预览:", prompt.slice(0, 100) + "...");

  const answer = await callFreeAPI(prompt);

  return {
    answer,
    answer_type: decision.answer_type,
    confidence: decision.confidence,
    sources: topDocs,
    method: API_PROVIDER
  };
}

// ===== 8️⃣ 种子数据同步 =====
async function seedData(col, docs) {
  console.log("🛠️ 正在同步知识库数据...");
  for (const text of docs) {
    const exists = await col.findOne({ content: text });
    if (!exists) {
      const embedding = await getEmbedding(text);
      await col.insertOne({
        content: text,
        embedding,
        createdAt: new Date()
      });
    }
  }
  console.log("✅ 知识库就绪\n");
}

// ===== 9️⃣ 主函数 =====
async function main() {
  try {
    const col = await getCollection();
    const data = JSON.parse(await fs.readFile("./Data/data.json", "utf-8"));
    const tests = JSON.parse(await fs.readFile("./Data/tests.json", "utf-8"));

    await seedData(col, data);

    console.log("=== 🤖 批量测试开始 (免费 API) ===");
    console.log(`🌐 提供商: ${API_PROVIDER}`);
    console.log(`📦 模型: ${MODEL_NAME}\n`);

    for (const [index, query] of tests.entries()) {
      console.log(`\n${"=".repeat(50)}`);
      console.log(`测试 ${index + 1}: ${query}`);
      console.log("=".repeat(50));

      const start = Date.now();
      const result = await ragAnswer(col, query);
      const duration = ((Date.now() - start) / 1000).toFixed(2);

      console.log(`\n✅ 答案: ${result.answer}`);
      console.log(`📊 类型: ${result.answer_type}`);
      console.log(`🎯 置信度: ${result.confidence.toFixed(4)}`);
      console.log(`🔧 提供商: ${result.method}`);
      
      if (result.sources.length > 0) {
        console.log(`\n📚 匹配到的资料:`);
        result.sources.forEach((doc, i) => {
          console.log(`   ${i + 1}. ${doc.content.slice(0, 40)}... (相似度: ${doc.score.toFixed(4)})`);
        });
      }
      
      console.log(`⏱️  耗时: ${duration}s`);
    }

    console.log("\n\n=== ✅ 测试完成 ===");
    
  } catch (err) {
    console.error("❌ 出错:", err.message);
    if (err.stack) console.error("堆栈:", err.stack);
  } finally {
    await client.close();
  }
}

main();