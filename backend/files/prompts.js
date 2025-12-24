export function buildPrompt(answer_type, context, question) {
  switch (answer_type) {
    case "rag_strict":
      return `
根据以下资料回答问题。
只能使用资料中的信息。
如果资料中没有答案，请回答：未在提供的资料中找到答案。

资料：
${context}

问题：
${question}
`;

    case "rag_hybrid":
      return `
请回答以下问题。
你可以使用常识，也可以参考提供的资料。

资料（可能不完全相关）：
${context}

问题：
${question}
`;

    case "llm_only":
      return `
请用你的常识知识回答以下问题：

问题：
${question}
`;

    default:
      throw new Error("Unknown answer_type");
  }
}
