import { z } from "zod";

export const remediationOutputSchema = z.object({
  checkId: z.string(),
  fix: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  sources: z.string().array(),
});

export type StructuredRemediation = z.infer<typeof remediationOutputSchema>;

export interface AiClientConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export function getAiConfig(): AiClientConfig {
  return {
    apiKey: process.env.AI_API_KEY,
    baseUrl: process.env.AI_API_BASE_URL || "https://openrouter.ai/api/v1",
    model: process.env.AI_MODEL || "meta-llama/llama-3.2-3b-instruct:free",
  };
}

/**
 * Executes structured remediation using OpenRouter / OpenAI compatible endpoint.
 * Follows system prompt: "Rewrite the retrieved fix as one concrete, copy-pasteable
 * remediation step. Cite sources. Never invent endpoints, headers, or spec fields
 * not present in the retrieved evidence."
 */
export async function generateRemediationWithLlm(params: {
  checkId: string;
  checkName: string;
  checkMessage: string;
  retrievedFix: string;
  sources: string[];
}): Promise<StructuredRemediation | null> {
  const config = getAiConfig();
  if (!config.apiKey) return null;

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "Rewrite the retrieved fix as one concrete, copy-pasteable remediation step. Cite sources. Never invent endpoints, headers, or spec fields not present in the retrieved evidence. Output strictly valid JSON matching schema: {\"checkId\": string, \"fix\": string, \"confidence\": \"high\"|\"medium\"|\"low\", \"sources\": string[]}.",
          },
          {
            role: "user",
            content: JSON.stringify({
              checkId: params.checkId,
              checkName: params.checkName,
              checkMessage: params.checkMessage,
              retrievedFix: params.retrievedFix,
              sources: params.sources,
            }),
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    return remediationOutputSchema.parse(parsed);
  } catch {
    return null;
  }
}
