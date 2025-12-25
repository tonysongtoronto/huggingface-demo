import { pipeline, env } from "@huggingface/transformers";
import dotenv from "dotenv";

dotenv.config();

// ===== 1️⃣ Embedding 配置 =====
env.allowLocalModels = true;
env.backends.onnx.wasm.numThreads = 4;
env.backends.onnx.wasm.simd = true;

const EMBEDDING_MODEL = "Xenova/bge-m3";

let embedderPromise = null;

// ===== 2️⃣ 单例加载 Embedding 模型 =====
export async function getEmbedder() {
  if (!embedderPromise) {
    console.log(`🚀 加载 Embedding 模型 (${EMBEDDING_MODEL})...`);
    embedderPromise = pipeline("feature-extraction", EMBEDDING_MODEL, {
      quantized: true
    });
  }
  return embedderPromise;
}

// ===== 3️⃣ 单条文本 embedding =====
export async function embedText(text) {
  const model = await getEmbedder();
  const output = await model(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

// ===== 4️⃣ 批量文本 embedding =====
export async function embedBatch(texts) {
  const model = await getEmbedder();
  const results = [];

  for (const t of texts) {
    const embedding = await model(t, { pooling: "mean", normalize: true });
    results.push(Array.from(embedding.data));
  }

  return results;
}

// ===== 5️⃣ Embedding 自检函数 =====
export async function embeddingSelfTest() {
  console.log("🔍 正在进行 embedding 自检…");
  const testSentences = [
    "Hello world",
    "测试中文句子"
  ];

  const vectors = await embedBatch(testSentences);

  vectors.forEach((v, i) => {
    console.log(`✅ [${i}] 长度: ${v.length}, 前5维: ${v.slice(0,5).map(n=>n.toFixed(4))}`);
  });

  console.log("✅ Embedding 自检完成\n");
}
