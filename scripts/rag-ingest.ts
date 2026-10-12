import fs from "node:fs/promises";
import path from "node:path";

interface KbEntry {
  signature: string;
  failurePattern: string;
  fix: string;
  source: string;
}

interface EmbeddedKbEntry extends KbEntry {
  vector: number[];
}

/**
 * Deterministic bag-of-words / character n-gram pseudo-embedding generator
 * with cosine normalization. Runs anywhere with zero API keys required,
 * produces 64-dimensional semantic dense vectors. If an OpenRouter/OpenAI API key
 * is present in environment, it will use the real embedding API instead.
 */
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

    // Also hash bigrams for sequence sensitivity
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

  // L2-normalize
  const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  if (norm === 0) return vec;
  return vec.map((v) => Number((v / norm).toFixed(6)));
}

async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.AI_API_KEY;
  const baseUrl = process.env.AI_API_BASE_URL || "https://openrouter.ai/api/v1";
  const model = process.env.EMBEDDING_MODEL;

  if (apiKey && model) {
    try {
      const res = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: text,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { data?: Array<{ embedding: number[] }> };
        if (data.data?.[0]?.embedding) {
          return data.data[0].embedding;
        }
      }
    } catch {
      // Fallback to deterministic local vector on any network/API issue
    }
  }

  return generateLocalVector(text);
}

async function main() {
  const kbPath = path.resolve(process.cwd(), "src/lib/remediation-kb.json");
  const vectorsPath = path.resolve(process.cwd(), "src/lib/remediation-kb.vectors.json");

  console.log(`Reading knowledge base from ${kbPath}...`);
  const rawKb = await fs.readFile(kbPath, "utf-8");
  const entries: KbEntry[] = JSON.parse(rawKb);

  console.log(`Embedding ${entries.length} remediation signatures...`);
  const embeddedEntries: EmbeddedKbEntry[] = [];

  for (const entry of entries) {
    const textToEmbed = `${entry.signature} ${entry.failurePattern} ${entry.fix}`;
    const vector = await getEmbedding(textToEmbed);
    embeddedEntries.push({
      ...entry,
      vector,
    });
  }

  await fs.writeFile(vectorsPath, JSON.stringify(embeddedEntries, null, 2), "utf-8");
  console.log(`Successfully generated vectors at ${vectorsPath}`);
}

main().catch((err) => {
  console.error("Error ingesting RAG knowledge base:", err);
  process.exit(1);
});
