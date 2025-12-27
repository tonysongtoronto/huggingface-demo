import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import { env } from "@huggingface/transformers";
import fs from "fs/promises";
import { AnswerPolicy } from "./files/answerPolicy.js";
import { getCollection, } from "./files/MODELS.js";

import { exportResults, runMultiTurnTests, runSingleTurnTests, seedData } from "./files/callAPI.js";

dotenv.config();

/* =========================================================
 * 1️⃣ Embedding 配置
 * ========================================================= */
env.allowLocalModels = true;
env.backends.onnx.wasm.numThreads = 4;
env.backends.onnx.wasm.simd = true;



/* =========================================================
 * 3️⃣ MongoDB
 * ========================================================= */
const client = new MongoClient(process.env.MONGO_URI);



/* =========================================================
 * 5️⃣ AnswerPolicy
 * ========================================================= */
export const policy = new AnswerPolicy({ highThreshold: 0.9, lowThreshold: 0.85, minGapForStrict: 0.05 });

/* =========================================================
 * 1️⃣3️⃣ Main
 * ========================================================= */
async function main() {
  try {
    const col = await getCollection();
    const data = JSON.parse(await fs.readFile("./Data/data.json", "utf-8"));
    const singleTests = JSON.parse(await fs.readFile("./Data/tests.json", "utf-8"));

    await seedData(col, data);

    console.log("\n=== 🤖 单轮 RAG 测试 ===");
    const singleResults = await runSingleTurnTests(col, singleTests);
    await exportResults(singleResults, "single_turn");

    console.log("\n=== 🤖 多轮 RAG 测试 ===");
    const multiResults = await runMultiTurnTests(col);
    await exportResults(multiResults, "multi_turn");

  } catch (e) {
    console.error("❌ 错误:", e.message);
  } finally {
    await client.close();
  }
}

main();
