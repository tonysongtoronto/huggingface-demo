import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import { pipeline, env } from "@huggingface/transformers";

dotenv.config();

/* =========================================================
 * 1️⃣ Embedding 配置
 * ========================================================= */
env.allowLocalModels = true;
env.backends.onnx.wasm.numThreads = 4;
env.backends.onnx.wasm.simd = true;

const EMBEDDING_MODEL = "Xenova/bge-m3";

/* =========================================================
 * 2️⃣ 多模型配置
 * ========================================================= */
export const MODELS = [
  { 
    name: "Groq", 
    apiKey: process.env.GROQ_API_KEY, 
    url: "https://api.groq.com/openai/v1/chat/completions", 
    modelName: "llama-3.3-70b-versatile" 
  },
  //  { 
  //   name: "siliconflow", 
  //   apiKey: process.env.SILICONFLOW_API_KEY, 
  //   url: "https://api.siliconflow.com/v1/chat/completions", 
  //   modelName: "Qwen/Qwen2.5-7B-Instruct" 
  // },
];

/* =========================================================
 * 3️⃣ MongoDB
 * ========================================================= */
const client = new MongoClient(process.env.MONGO_URI);

/* =========================================================
 * 4️⃣ Embedding 单例
 * ========================================================= */
let embedderPromise = null;

export function getEmbedder() {
  if (!embedderPromise) {
    console.log(`🚀 加载 Embedding 模型 (${EMBEDDING_MODEL})...`);  // ✅ 修复：使用圆括号，不是反引号
    embedderPromise = pipeline("feature-extraction", EMBEDDING_MODEL, { quantized: true });
  }
  return embedderPromise;
}

export async function getEmbedding(text) {
  const model = await getEmbedder();
  const output = await model(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

export async function getCollection() {
  await client.connect();
  return client.db(process.env.MONGO_DB || "rag_test").collection("documents");
}

export async function searchVector(col, query, k = 3) {
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