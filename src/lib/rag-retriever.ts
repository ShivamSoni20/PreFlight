import type { AuditCheck } from "@/lib/preflight-types";
import kbVectors from "@/lib/remediation-kb.vectors.json";

export interface RetrievedFix {
  signature: string;
  fix: string;
  source: string;
  similarity: number;
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function generateLocalVector(text: string, dimensions = 64): number[] {
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const vec = new Array(dimensions).fill(0);

  for (const token of tokens) {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = (hash << 5) - hash + token.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % dimensions;
    const sign = hash % 2 === 0 ? 1 : -1;
    vec[idx] += sign * (1 + token.length * 0.1);

    for (let j = 0; j < token.length - 1; j++) {
      const bigram = token.slice(j, j + 2);
      let bHash = 0;
      for (let k = 0; k < bigram.length; k++) {
        bHash = (bHash << 5) - bHash + bigram.charCodeAt(k);
        bHash |= 0;
      }
      const bIdx = Math.abs(bHash) % dimensions;
      vec[bIdx] += 0.5;
    }
  }

  const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  if (norm === 0) return vec;
  return vec.map((v) => Number((v / norm).toFixed(6)));
}

/**
 * Retrieves top matching fixes for failed checks from the pre-indexed vector knowledge base.
 * Similarity threshold is 0.55 (irrelevant entries below threshold are filtered out).
 */
export function retrieveFixes(
  failedChecks: AuditCheck[],
  k = 3,
  threshold = 0.55
): Map<string, RetrievedFix[]> {
  const resultMap = new Map<string, RetrievedFix[]>();

  for (const check of failedChecks) {
    const queryText = `${check.id} ${check.name} ${check.message} ${check.fix || ""}`;
    const queryVector = generateLocalVector(queryText);

    const scored = (kbVectors as Array<{ signature: string; failurePattern: string; fix: string; source: string; vector: number[] }>)
      .map((entry) => {
        // Direct string match bonus if failure pattern matches
        let sim = cosineSimilarity(queryVector, entry.vector);
        const lowerMsg = check.message.toLowerCase();
        const lowerPattern = entry.failurePattern.toLowerCase();
        if (lowerMsg.includes(lowerPattern) || lowerPattern.includes(check.id.toLowerCase())) {
          sim = Math.max(sim, 0.85);
        }
        return {
          signature: entry.signature,
          fix: entry.fix,
          source: entry.source,
          similarity: sim,
        };
      })
      .filter((r) => r.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k);

    resultMap.set(check.id, scored);
  }

  return resultMap;
}
