import fs from "fs/promises";
import { parse } from "json2csv";

import { getEmbedding, MODELS, searchVector } from "./MODELS.js";
import { formatContext, generatePrompt, generateSystemPrompt } from "./prompts.js";
import { policy } from "../rag-tests.js";

/* =========================================================
 * 6️⃣ LLM 调用
 * ========================================================= */
export async function callAPI(modelConfig, messages) {
    if (!modelConfig.apiKey) return "缺少 API Key";
    const response = await fetch(modelConfig.url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${modelConfig.apiKey}`
        },
        body: JSON.stringify({
            model: modelConfig.modelName,
            messages,
            max_tokens: 250,
            temperature: 0.65
        })
    });

    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    return data.choices[0].message.content.trim();
}/* =========================================================
 * 8️⃣ 多轮 RAG（带历史）
 * ========================================================= */
export async function ragAnswerWithHistory(col, question, sessionMessages, modelConfig) {

    const { systemPrompt, prompt, decision, topDocs } = await newFunction(col, question);

    const messages = [{ role: "system", content: systemPrompt }];
    if (sessionMessages.length > 0) {
        messages.push({ role: "system", content: "以下是之前的对话记录，仅供参考，不保证其正确性。" });
        messages.push(...sessionMessages);
    }
    messages.push({ role: "user", content: prompt });

    const answer = await callAPI(modelConfig, messages);
    return { question, answer, answer_type: decision.answer_type, confidence: decision.confidence, sources: topDocs, model: modelConfig.name };
}
export async function newFunction(col, question) {
    const topDocs = await searchVector(col, question);
    const decision = policy.decide(topDocs);
    const context = formatContext(topDocs);
    const topScore = topDocs[0]?.score || 0;
    const prompt = generatePrompt(decision.answer_type, question, context, topScore);
    const systemPrompt = generateSystemPrompt(decision.answer_type);
    return { systemPrompt, prompt, decision, topDocs };
}
/* =========================================================
 * 9️⃣ 数据种子
 * ========================================================= */
export async function seedData(col, docs) {
    for (const text of docs) {
        const exists = await col.findOne({ content: text });
        if (!exists) {
            const embedding = await getEmbedding(text);
            await col.insertOne({ content: text, embedding, createdAt: new Date() });
        }
    }
}
/* =========================================================
 * 🔟 单轮测试
 * ========================================================= */
export async function runSingleTurnTests(col, questions) {
    const results = [];
    for (const q of questions) {
        for (const model of MODELS) {
            const r = await ragAnswer(col, q, model);
            console.log(`Q: ${q}\nA: ${r.answer}\nType: ${r.answer_type} | Conf: ${r.confidence}\nModel: ${model.name}\n`);
            results.push(r);
        }
    }
    return results;
}
/* =========================================================
 * 1️⃣1️⃣ 多轮测试
 * ========================================================= */
export async function runMultiTurnTests(col) {
    const suites = JSON.parse(await fs.readFile("./Data/multi_turn_tests.json", "utf-8"));
    const results = [];

    for (const suite of suites) {
        const sessionMessages = [];
        console.log(`\n🧩 场景：${suite.name}`);
        console.log("-".repeat(60));

        for (let i = 0; i < suite.turns.length; i++) {
            const q = suite.turns[i].q;
            for (const model of MODELS) {
                const r = await ragAnswerWithHistory(col, q, sessionMessages, model);
                results.push(r);
                console.log(`▶️ 第 ${i + 1} 轮 | Model: ${model.name}`);
                console.log(`Q: ${q}\nA: ${r.answer}\nType: ${r.answer_type} | Conf: ${r.confidence}\n`);
            }
            // 更新历史
            sessionMessages.push({ role: "user", content: q });
            sessionMessages.push({ role: "assistant", content: results[results.length - 1].answer });
        }
    }
    return results;
}
/* =========================================================
 * 1️⃣2️⃣ 导出 CSV + JSON
 * ========================================================= */
export async function exportResults(results, prefix) {
    await fs.mkdir("./output", { recursive: true });
    const jsonPath = `./output/${prefix}_results.json`;
    const csvPath = `./output/${prefix}_results.csv`;

    await fs.writeFile(jsonPath, JSON.stringify(results, null, 2), "utf-8");
    const csv = parse(results, { fields: ["model", "question", "answer", "answer_type", "confidence"] });
    await fs.writeFile(csvPath, csv, "utf-8");

    console.log(`✅ ${prefix} 测试结果已导出 CSV + JSON`);
}
/* =========================================================
 * 7️⃣ 单轮 RAG
 * ========================================================= */

export async function ragAnswer(col, question, modelConfig) {

    const { systemPrompt, prompt, decision, topDocs } = await newFunction(col, question);

    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
    ];

    const answer = await callAPI(modelConfig, messages);
    return { question, answer, answer_type: decision.answer_type, confidence: decision.confidence, sources: topDocs, model: modelConfig.name };
}

