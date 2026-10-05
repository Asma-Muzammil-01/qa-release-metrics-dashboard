import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  project: z.string().max(80),
  version: z.string().max(40),
  passRate: z.number(),
  coverage: z.number(),
  bugs: z.object({ critical: z.number(), high: z.number(), medium: z.number(), low: z.number() }),
  density: z.array(z.object({ module: z.string().max(40), density: z.number() })).max(30),
  testResults: z.string().max(8000),
  defects: z.string().max(8000),
});

export type RiskItem = { title: string; severity: "critical" | "high" | "medium" | "low"; area: string; detail: string };
export type FixItem = { priority: number; action: string; rationale: string; effort: "S" | "M" | "L" };
export type RiskReport = { summary: string; verdict: "GO" | "CAUTION" | "NO-GO"; risks: RiskItem[]; fixes: FixItem[] };

export const analyzeRelease = createServerFn({ method: "POST" })
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }): Promise<{ ok: true; report: RiskReport } | { ok: false; error: string }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false, error: "AI is not configured." };
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const { createRunIdFetch } = await import("./ai-gateway.server");
    const runIdFetch = createRunIdFetch();
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });
    const instructions = `You are a senior QA release manager. Analyze the release data and return ONLY a JSON object (no markdown) with shape:
{"summary": string (2-3 sentences), "verdict": "GO"|"CAUTION"|"NO-GO",
 "risks": [{"title": string, "severity": "critical"|"high"|"medium"|"low", "area": string, "detail": string}] (3-6 items, most severe first),
 "fixes": [{"priority": number (1 = highest), "action": string, "rationale": string, "effort": "S"|"M"|"L"}] (3-6 items, ordered by priority)}.
Be specific and reference modules, numbers and defects from the input.`;
    try {
      const result = streamText({
        model: provider.responses("openai/gpt-6-astra"),
        instructions,
        messages: [{ role: "user", content: JSON.stringify(data) }],
        maxRetries: 0,
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        },
      });
      const text = await result.text;
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) return { ok: false, error: "The AI returned no analysis. Please try again." };
      return { ok: true, report: JSON.parse(m[0]) as RiskReport };
    } catch (e: any) {
      const status = e?.statusCode ?? e?.status ?? e?.lastError?.statusCode;
      console.error("analyzeRelease failed", status, e?.message);
      if (status === 429) return { ok: false, error: "Too many requests right now — please wait a moment and try again." };
      if (status === 402) return { ok: false, error: "AI credits are used up. Add credits in your workspace to continue." };
      if (status === 403) return { ok: false, error: "AI access is blocked for this workspace." };
      return { ok: false, error: "Analysis failed. Please try again." };
    }
  });
