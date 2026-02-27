import { generateObject } from "ai";
import { z } from "zod";
import { getModel, type ModelId } from "@/lib/ai/providers";

const suggestionSchema = z.object({
  cpcCodes: z.array(
    z.object({
      code: z.string(),
      description: z.string(),
      confidence: z.number().min(0).max(1),
    })
  ),
  patentType: z.object({
    recommended: z.enum(["utility", "design", "plant", "provisional"]),
    reasoning: z.string(),
  }),
  claimStrategy: z.object({
    independentClaimCount: z.number(),
    suggestedClaimTypes: z.array(
      z.enum([
        "method",
        "system",
        "apparatus",
        "composition",
        "computer_readable_medium",
      ])
    ),
    keyElements: z.array(z.string()),
    broadestClaimSuggestion: z.string(),
  }),
  drawingPlan: z.array(
    z.object({
      figureNumber: z.number(),
      description: z.string(),
      type: z.enum([
        "block_diagram",
        "flowchart",
        "schematic",
        "perspective_view",
        "cross_section",
        "exploded_view",
        "circuit_diagram",
      ]),
    })
  ),
  technicalField: z.string(),
  searchKeywords: z.array(z.string()),
});

export async function POST(req: Request) {
  try {
  const { model, inventionDescription, jurisdiction } = await req.json();

  const aiModel = getModel(model as ModelId);

  const result = await generateObject({
    model: aiModel,
    system: `You are a senior patent strategist with expertise in patent portfolio management, CPC classification, and prosecution strategy.

Given an invention description, provide comprehensive filing suggestions:

1. CPC CODES: Suggest the most relevant Cooperative Patent Classification codes with confidence scores. Include primary and secondary classifications.

2. PATENT TYPE: Recommend the most appropriate patent type (utility, design, plant, provisional) with reasoning.

3. CLAIM STRATEGY: Suggest how many independent claims, what claim types (method, system, apparatus, etc.), key elements to claim, and draft the broadest independent claim concept.

4. DRAWING PLAN: Suggest patent figures needed with descriptions and types. Patent drawings should comprehensively illustrate the invention.

5. TECHNICAL FIELD: A concise statement of the technical field for CPC alignment.

6. SEARCH KEYWORDS: Key terms for prior art searching.

${jurisdiction ? `Target jurisdiction: ${jurisdiction}. Tailor suggestions accordingly.` : "Provide suggestions suitable for US utility patent filing."}

Be specific and actionable. Base CPC suggestions on the current classification scheme.`,
    prompt: `Invention Description:\n${inventionDescription}`,
    schema: suggestionSchema,
  });

  return Response.json(result.object);
  } catch (error) {
    console.error("Suggestion error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: `Failed to generate suggestions: ${message}` },
      { status: 500 }
    );
  }
}
