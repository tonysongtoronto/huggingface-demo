export class AnswerPolicy {
  constructor({
    highThreshold = 0.90,
    lowThreshold = 0.85,
    minGapForStrict = 0.05
  } = {}) {
    this.highThreshold = highThreshold;
    this.lowThreshold = lowThreshold;
    this.minGapForStrict = minGapForStrict;
  }

  decide(topDocs) {
    if (!topDocs || topDocs.length === 0) {
      return { answer_type: "llm_only", confidence: 0.3 };
    }

    const topScore = topDocs[0].score;

    // top1 和 top2 差距太小 → 区分度不足，降级
    const hasLowDiscrimination = topDocs.length >= 2 && 
      (topDocs[0].score - topDocs[1].score) < this.minGapForStrict;

    if (topScore >= this.highThreshold && !hasLowDiscrimination) {
      return { 
        answer_type: "rag_strict", 
        confidence: topScore 
      };
    }

    if (topScore >= this.lowThreshold) {
      return { 
        answer_type: "rag_hybrid", 
        confidence: topScore 
      };
    }

    // 低于 lowThreshold 一律走 llm_only，置信度固定 0.3
    return { 
      answer_type: "llm_only", 
      confidence: 0.3 
    };
  }
}