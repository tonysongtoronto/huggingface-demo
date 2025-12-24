export class AnswerPolicy {
  constructor({ highThreshold = 0.75, lowThreshold = 0.5 } = {}) {
    this.highThreshold = highThreshold;
    this.lowThreshold = lowThreshold;
  }

  decide(topDocs) {
    if (!topDocs || topDocs.length === 0) {
      return { answer_type: "llm_only", confidence: 0.3 };
    }

    const score = topDocs[0].score;

    if (score >= this.highThreshold) {
      return { answer_type: "rag_strict", confidence: Math.min(score, 0.95) };
    }

    if (score >= this.lowThreshold) {
      return { answer_type: "rag_hybrid", confidence: score };
    }

    return { answer_type: "llm_only", confidence: score };
  }
}
