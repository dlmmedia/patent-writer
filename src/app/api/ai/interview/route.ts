import { generateObject } from "ai";
import { z } from "zod";
import { getModel, type ModelId, MODEL_PROVIDER_MAP, isGoogleModel, isOpenAIModel } from "@/lib/ai/providers";

const interviewSchema = z.object({
  questions: z
    .array(z.string())
    .describe("3-5 targeted follow-up questions about the invention"),
});

function buildInterviewPrompt(
  disclosure: {
    title?: string;
    inventionDescription?: string;
    inventionProblem?: string;
    inventionSolution?: string;
    technologyArea?: string;
    keyFeatures?: { feature: string; description?: string; isNovel?: boolean }[];
    knownPriorArt?: string;
  },
  previousResponses: { question: string; answer: string; round: number }[],
  round: number
): string {
  const parts: string[] = [];

  parts.push("You are a senior patent attorney conducting an invention disclosure interview.");
  parts.push("Your goal is to extract sufficient detail for a strong patent application by identifying:");
  parts.push("- Enablement gaps (would a person of ordinary skill be able to practice the invention?)");
  parts.push("- Missing embodiments or alternative implementations");
  parts.push("- Claim scope opportunities (broader or narrower claims)");
  parts.push("- Unclear technical details that need elaboration");
  parts.push("- Potential advantages or unexpected results");
  parts.push("");

  if (disclosure.title) parts.push(`Title: ${disclosure.title}`);
  if (disclosure.technologyArea) parts.push(`Technology Area: ${disclosure.technologyArea}`);
  if (disclosure.inventionProblem) parts.push(`Problem: ${disclosure.inventionProblem}`);
  if (disclosure.inventionSolution) parts.push(`Solution: ${disclosure.inventionSolution}`);
  if (disclosure.inventionDescription) parts.push(`Description: ${disclosure.inventionDescription}`);

  if (disclosure.keyFeatures && disclosure.keyFeatures.length > 0) {
    parts.push("\nKey Features:");
    for (const f of disclosure.keyFeatures) {
      const novel = f.isNovel ? " [NOVEL]" : "";
      parts.push(`  - ${f.feature}${novel}${f.description ? `: ${f.description}` : ""}`);
    }
  }

  if (disclosure.knownPriorArt) {
    parts.push(`\nKnown Prior Art: ${disclosure.knownPriorArt}`);
  }

  if (previousResponses.length > 0) {
    parts.push("\n--- Previous Interview Q&A ---");
    for (const r of previousResponses) {
      parts.push(`Q (Round ${r.round}): ${r.question}`);
      parts.push(`A: ${r.answer}`);
    }
  }

  parts.push(`\nThis is round ${round} of 3.`);

  if (round === 1) {
    parts.push("Generate 3-5 targeted questions that probe for missing technical details, alternative embodiments, and enablement completeness.");
    parts.push("Adapt your questions to the technology area (software, mechanical, chemical, etc.).");
  } else if (round === 2) {
    parts.push("Based on the previous answers, generate 3-5 deeper follow-up questions focusing on claim scope, specific implementations, and edge cases.");
  } else {
    parts.push("Final round. Generate 2-3 questions about any remaining gaps. Focus on variations, materials/parameters, and scope limitations.");
    parts.push("If the disclosure is already comprehensive, return an empty questions array.");
  }

  parts.push("\nReturn ONLY questions. Each question should be specific and actionable.");

  return parts.join("\n");
}

export async function POST(req: Request) {
  try {
    const { disclosure, previousResponses, round, model } = await req.json();

    if (!disclosure) {
      return Response.json({ error: "disclosure is required" }, { status: 400 });
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

    const prompt = buildInterviewPrompt(
      disclosure,
      previousResponses || [],
      round || 1
    );

    const result = await generateObject({
      model: getModel(modelId),
      prompt,
      schema: interviewSchema,
    });

    return Response.json({
      questions: result.object.questions,
      round: round || 1,
    });
  } catch (error) {
    console.error("Interview error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
