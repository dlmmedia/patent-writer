import { generateObject } from "ai";
import { z } from "zod";
import { getModel, type ModelId, models } from "@/lib/ai/providers";
import { getSystemPrompt } from "@/lib/ai/prompts";

const claimSchema = z.object({
  claims: z.array(
    z.object({
      claimNumber: z.number(),
      claimType: z.enum([
        "method",
        "system",
        "apparatus",
        "composition",
        "computer_readable_medium",
      ]),
      isIndependent: z.boolean(),
      parentClaimNumber: z.number().nullable(),
      transitionalPhrase: z.enum([
        "comprising",
        "consisting of",
        "consisting essentially of",
      ]),
      preamble: z.string(),
      body: z.string(),
      fullText: z.string(),
    })
  ),
});

export async function POST(req: Request) {
  try {
    const {
      model,
      inventionDescription,
      claimType,
      existingClaims,
      instructions,
      jurisdiction,
      count,
    } = await req.json();

    if (!inventionDescription) {
      return Response.json(
        { error: "Invention description is required to generate claims." },
        { status: 400 }
      );
    }

    const modelId = model as ModelId;
    if (!(modelId in models)) {
      return Response.json(
        { error: `Invalid model "${model}". Valid models: ${Object.keys(models).join(", ")}` },
        { status: 400 }
      );
    }

    const systemPrompt = getSystemPrompt("claims", jurisdiction || "US");
    const aiModel = getModel(modelId);

    const promptParts = [
      `Invention Description:\n${inventionDescription}`,
      claimType && `Requested claim type: ${claimType}`,
      count && `Number of claims to generate: ${count}`,
      existingClaims?.length > 0 &&
        `Existing claims to build upon:\n${JSON.stringify(existingClaims, null, 2)}`,
      instructions && `Additional instructions:\n${instructions}`,
    ].filter(Boolean);

    const result = await generateObject({
      model: aiModel,
      system: systemPrompt,
      prompt: promptParts.join("\n\n"),
      schema: claimSchema,
    });

    return Response.json(result.object);
  } catch (error) {
    console.error("Claims generation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: `Failed to generate claims: ${message}` },
      { status: 500 }
    );
  }
}
