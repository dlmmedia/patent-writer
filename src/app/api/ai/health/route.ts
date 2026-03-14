export const maxDuration = 30;

import { generateText } from "ai";
import { getModel, checkProviderAvailability, type ModelId } from "@/lib/ai/providers";

export async function GET() {
  const availability = checkProviderAvailability();
  const results: Record<string, unknown> = { availability };

  const modelsToTest: { id: ModelId; provider: string }[] = [];

  if (availability.google) {
    modelsToTest.push({ id: "gemini-2.5-flash", provider: "google" });
  }
  if (availability.openai) {
    modelsToTest.push({ id: "gpt-4o-mini", provider: "openai" });
  }

  for (const { id, provider } of modelsToTest) {
    try {
      const model = getModel(id);
      const result = await generateText({
        model,
        prompt: "Say OK",
        abortSignal: AbortSignal.timeout(15_000),
      });
      results[provider] = { status: "ok", text: result.text };
    } catch (err: unknown) {
      const info: Record<string, unknown> = {
        status: "error",
        type: err instanceof Error ? err.constructor.name : typeof err,
        message: err instanceof Error ? err.message.substring(0, 500) : String(err),
      };
      if (typeof err === "object" && err !== null) {
        const e = err as Record<string, unknown>;
        if (e.statusCode) info.statusCode = e.statusCode;
        if (e.url) info.url = e.url;
        if (e.responseBody) {
          const body = typeof e.responseBody === "string" ? e.responseBody.substring(0, 1000) : e.responseBody;
          info.responseBody = body;
        }
      }
      results[provider] = info;
    }
  }

  return Response.json(results);
}
