import { generateObject } from "ai";
import { z } from "zod";
import { getModel, type ModelId, models } from "@/lib/ai/providers";

const analysisSchema = z.object({
  riskLevel: z.enum(["high", "medium", "low"]),
  relevanceScore: z.number().min(0).max(1),
  analysis: z.string(),
  overlappingElements: z.array(z.string()),
  differentiatingFeatures: z.array(z.string()),
  recommendation: z.string(),
});

export async function POST(req: Request) {
  try {
    const { model, claimText, priorArtAbstract, priorArtTitle, jurisdiction } =
      await req.json();

    const modelId = model as ModelId;
    if (!(modelId in models)) {
      return Response.json(
        { error: `Invalid model "${model}".` },
        { status: 400 }
      );
    }

    const aiModel = getModel(modelId);

    const result = await generateObject({
      model: aiModel,
      system: `You are a patent examiner and prior art analyst with deep expertise in novelty and non-obviousness analysis.

Analyze the provided patent claim against the prior art reference. Assess:
1. Risk level: how likely the prior art is to invalidate the claim
2. Relevance score: 0.0 (irrelevant) to 1.0 (directly anticipating)
3. Overlapping elements: claim elements found in the prior art
4. Differentiating features: claim elements NOT found in the prior art
5. Recommendation: actionable advice for the patent drafter

${jurisdiction === "EP" ? "Apply the EPO problem-solution approach for inventive step analysis." : ""}
${jurisdiction === "US" ? "Apply the Graham v. John Deere factors for obviousness analysis under 35 U.S.C. §103." : ""}
${jurisdiction === "CN" ? "Apply CNIPA guidelines for inventive step (creativeness) analysis." : ""}
${jurisdiction === "JP" ? "Apply JPO guidelines for inventive step analysis." : ""}

Be thorough but concise. Identify the closest matching elements and clearly articulate distinctions.`,
      prompt: `CLAIM UNDER ANALYSIS:
${claimText}

PRIOR ART REFERENCE:
Title: ${priorArtTitle || "Unknown"}
Abstract: ${priorArtAbstract}`,
      schema: analysisSchema,
    });

    return Response.json(result.object);
  } catch (error) {
    console.error("Analysis error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: `Failed to analyze: ${message}` },
      { status: 500 }
    );
  }
}
