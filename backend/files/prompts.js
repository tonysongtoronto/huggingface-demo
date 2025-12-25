/**
 * Prompt 生成器
 * 根据决策类型生成对应的 Prompt
 * @param {string} type - 决策类型 (rag_strict, rag_hybrid, llm_only)
 * @param {string} question - 用户提出的问题
 * @param {string} context - 拼接好的背景资料字符串
 * @param {number} topScore - 最高相似度分数
 * @returns {string} 生成的 Prompt
 */
// 精简版 generatePrompt 只管放上下文和问题
export function generatePrompt(type, question, context = "", topScore = 0) {
  const scoreText = topScore.toFixed(3);
  
  let header = `最高匹配相似度：${scoreText}（满分1.0）\n\n`;
  if (context) header += `参考资料：\n${context}\n\n`;
  
  switch(type) {
    case "rag_strict":
      return header + `请严格只用上面资料原文回答以下问题：\n${question}`;
    case "rag_hybrid":
      return header + `请回答以下问题：\n${question}`;
    case "llm_only":
      return question;
    default:
      return question;
  }
}

// system prompt 承载所有行为规则（最重要！）
export function  generateSystemPrompt(type) {
  const base = "你是一个专业、诚实、极度遵守指令的回答助手。回答必须极度简洁，只说重点。";

  const templates = {
    rag_strict: 
      `${base}\n` +
      "【绝对严格模式】\n" +
      "1. 只能使用【提供的参考资料】中**明确出现**的原文内容\n" +
      "2. 严禁任何猜测、推论、常识补充、改写、扩展\n" +
      "3. 资料里找不到完整答案 → 必须**一字不差**回复：'资料中未找到相关信息'\n" +
      "4. 回答只能是一句话，不要任何解释、前缀、废话",

    rag_hybrid:
      `${base}\n` +
      "【谨慎混合模式】\n" +
      "1. 优先严格使用参考资料里的原文\n" +
      "2. 资料不完整/没覆盖 → 可以适度补充常识，但**必须**在前方或后方明确标注：【根据常识补充】\n" +
      "3. 完全没相关资料 → 开头必须写：资料中未提及，根据常识回答：\n" +
      "4. 整条回答尽量控制在一句话",

    llm_only:
      `${base}\n` +
      "用最简洁、准确的一句话直接回答问题，不要任何多余文字。"
  };

  return templates[type] || base;
}
/**
 * 格式化上下文资料（显示相似度，便于模型和调试时参考）
 */
export function formatContext(docs) {
  if (!docs?.length) return "（暂无匹配资料）";

  return docs
    .map((doc, i) => `资料${i + 1}（相似度 ${doc.score?.toFixed(4) || '未知'}）：${doc.content}`)
    .join("\n\n");
}

/**
 * 构建完整的 messages 数组（建议总是启用 system prompt）
 */
export function buildMessages(type, question, context = "", useSystemPrompt = true) {
  const messages = [];

  if (useSystemPrompt) {
    const systemContent = generateSystemPrompt(type);
    messages.push({
      role: "system",
      content: systemContent
    });
  }

  messages.push({
    role: "user",
    content: generatePrompt(type, question, context)
  });

  return messages;
}