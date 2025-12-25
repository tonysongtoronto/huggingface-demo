import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import fs from "fs/promises";

import { AnswerPolicy } from "./files/answerPolicy.js";
import {
  generatePrompt,
  formatContext,
  generateSystemPrompt
} from "./files/prompts.js";

import {
  embedText,
  embedBatch,
  embeddingSelfTest
} from "./files/embeddings.js";

dotenv.config();

/* =========================================================
 * 1️⃣ LLM API 配置（Groq）
 * ========================================================= */
const API_PROVIDER = "groq";
const API_KEY = process.env.GROQ_API_KEY;
const API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL_NAME = "llama-3.3-70b-versatile";

/* =========================================================
 * 2️⃣ MongoDB
 * ========================================================= */
const client = new MongoClient(process.env.MONGO_URI);

/* =========================================================
 * 3️⃣ LLM 调用（单轮）
 * ========================================================= */
async function callFreeAPI(prompt, systemPrompt = null) {
  if (!API_KEY) throw new Error("缺少 GROQ_API_KEY");

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages,
      max_tokens: 250,
      temperature: 0.65
    })
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

/* =========================================================
 * 4️⃣ LLM 调用（多轮，吃历史）
 * ========================================================= */
async function callFreeAPIWithHistory(messages) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages,
      max_tokens: 250,
      temperature: 0.65
    })
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

/* =========================================================
 * 5️⃣ Mongo Collection
 * ========================================================= */
async function getCollection() {
  await client.connect();
  return client
    .db(process.env.MONGO_DB || "rag_test")
    .collection("documents");
}

/* =========================================================
 * 6️⃣ 向量搜索（使用 embeddings.js）
 * ========================================================= */
async function searchVector(col, query, k = 3) {
  const qEmbedding = await embedText(query);

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

/* =========================================================
 * 7️⃣ AnswerPolicy
 * ========================================================= */
const policy = new AnswerPolicy({
  highThreshold: 0.9,
  lowThreshold: 0.85,
  minGapForStrict: 0.05
});

/* =========================================================
 * 8️⃣ 单轮 RAG（保持原逻辑）
 * ========================================================= */
async function ragAnswer(col, question) {
  const topDocs = await searchVector(col, question);
  const decision = policy.decide(topDocs);
  const context = formatContext(topDocs);
  const topScore = topDocs[0]?.score || 0;

  const prompt = generatePrompt(
    decision.answer_type,
    question,
    context,
    topScore
  );
  const systemPrompt = generateSystemPrompt(decision.answer_type);

  const answer = await callFreeAPI(prompt, systemPrompt);

  return {
    answer,
    answer_type: decision.answer_type,
    confidence: decision.confidence,
    sources: topDocs
  };
}

/* =========================================================
 * 🔥 9️⃣ 多轮 RAG（吃历史）
 * ========================================================= */
async function ragAnswerWithHistory(col, question, sessionMessages) {
  const topDocs = await searchVector(col, question);
  const decision = policy.decide(topDocs);
  const context = formatContext(topDocs);
  const topScore = topDocs[0]?.score || 0;

  const prompt = generatePrompt(
    decision.answer_type,
    question,
    context,
    topScore
  );
  const systemPrompt = generateSystemPrompt(decision.answer_type);

  const messages = [
    { role: "system", content: systemPrompt }
  ];

  if (sessionMessages.length > 0) {
    messages.push({
      role: "system",
      content: "以下是之前的对话记录，仅供参考，不保证其正确性。"
    });
    messages.push(...sessionMessages);
  }

  messages.push({ role: "user", content: prompt });

  const answer = await callFreeAPIWithHistory(messages);

  return {
    answer,
    answer_type: decision.answer_type,
    confidence: decision.confidence,
    sources: topDocs
  };
}

/* =========================================================
 * 🔁 10️⃣ 多轮回归测试
 * ========================================================= */
async function runMultiTurnRagTests(col) {
  const suites = JSON.parse(
    await fs.readFile("./Data/multi_turn_tests.json", "utf-8")
  );

  console.log("\n=== 🧪 多轮 RAG 回归测试 ===\n");

  for (const suite of suites) {
    console.log(`🧩 场景：${suite.name}`);
    console.log("-".repeat(60));

    const sessionMessages = [];

    for (let i = 0; i < suite.turns.length; i++) {
      const q = suite.turns[i].q;
      console.log(`\n▶️ 第 ${i + 1} 轮：${q}`);

      const result = await ragAnswerWithHistory(
        col,
        q,
        sessionMessages
      );

      console.log(`✅ 回答：${result.answer}`);
      console.log(
        `📊 类型：${result.answer_type} | 置信度：${result.confidence.toFixed(3)}`
      );

      sessionMessages.push(
        { role: "user", content: q },
        { role: "assistant", content: result.answer }
      );
    }
  }

  console.log("\n=== ✅ 多轮测试结束 ===\n");
}

/* =========================================================
 * 1️⃣1️⃣ 种子数据（批量 embedding）
 * ========================================================= */
async function seedData(col, docs) {
  console.log("🛠️ 同步知识库…");

  const existing = await col.find({}, { projection: { content: 1 } }).toArray();
  const existingSet = new Set(existing.map(d => d.content));

  const newDocs = docs.filter(d => !existingSet.has(d));
  if (newDocs.length === 0) {
    console.log("✅ 知识库已是最新\n");
    return;
  }

  const vectors = await embedBatch(newDocs);

  const payload = newDocs.map((text, i) => ({
    content: text,
    embedding: vectors[i],
    createdAt: new Date()
  }));

  await col.insertMany(payload);
  console.log(`✅ 新增 ${payload.length} 条知识\n`);
}

/* =========================================================
 * 1️⃣2️⃣ main
 * ========================================================= */
async function main() {
  try {
    console.log("🔍 Embedding 自检中…");
    await embeddingSelfTest();

    const col = await getCollection();
    const data = JSON.parse(await fs.readFile("./Data/data.json", "utf-8"));
    const tests = JSON.parse(await fs.readFile("./Data/tests.json", "utf-8"));

    await seedData(col, data);

    console.log("\n=== 🤖 单轮 RAG 测试 ===\n");

    for (const q of tests) {
      const r = await ragAnswer(col, q);
      console.log(`Q: ${q}`);
      console.log(`A: ${r.answer}`);
      console.log(
        `📊 类型：${r.answer_type} | 置信度：${r.confidence.toFixed(3)}\n`
      );
    }

    await runMultiTurnRagTests(col);

  } catch (e) {
    console.error("❌ 错误：", e.message);
  } finally {
    await client.close();
  }
}

main();
