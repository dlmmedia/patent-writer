import { generateObject } from "ai";
import { z } from "zod";
import { getModel, type ModelId, MODEL_PROVIDER_MAP, isGoogleModel, isOpenAIModel } from "@/lib/ai/providers";
import { getTitleSuggestionPrompt } from "@/lib/ai/prompts";

const titleSchema = z.object({
  titles: z.array(z.string()).min(1).max(5),
});

export async function POST(req: Request) {
  try {
    const { inventionProblem, inventionSolution, inventionDescription, technologyArea, keyFeatures, model } =
      await req.json();

    const combined = [inventionProblem, inventionSolution, inventionDescription].filter(Boolean).join(". ");
    if (combined.trim().length < 10) {
      return Response.json({ error: "Provide at least a brief description" }, { status: 400 });
    }

    const modelId = (model || "gemini-2.5-flash") as ModelId;
    if (!(modelId in MODEL_PROVIDER_MAP)) {
      return Response.json({ error: `Invalid model "${model}".` }, { status: 400 });
    }
    if (isOpenAIModel(modelId) && !process.env.OPENAI_API_KEY) {
      return Response.json({ error: "OpenAI API key not configured." }, { status: 400 });
    }
    if (isGoogleModel(modelId) && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return Response.json({ error: "Google AI API key not configured." }, { status: 400 });
    }

    const contextParts: string[] = [];
    if (technologyArea) contextParts.push(`Technology: ${technologyArea}`);
    if (inventionProblem) contextParts.push(`Problem: ${inventionProblem}`);
    if (inventionSolution) contextParts.push(`Solution: ${inventionSolution}`);
    if (inventionDescription) contextParts.push(`Description: ${inventionDescription}`);
    if (keyFeatures && keyFeatures.length > 0) {
      contextParts.push("Key Features:");
      for (const f of keyFeatures) {
        contextParts.push(`  - ${f.feature}${f.isNovel ? " [novel]" : ""}`);
      }
    }

    const result = await generateObject({
      model: getModel(modelId),
      system: getTitleSuggestionPrompt(),
      prompt: contextParts.join("\n"),
      schema: titleSchema,
    });

    return Response.json({ titles: result.object.titles });
  } catch (error) {
    console.error("Title suggestion error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
