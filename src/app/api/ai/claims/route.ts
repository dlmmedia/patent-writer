import { generateObject } from "ai";
import { z } from "zod";
import {
  getModel,
  type ModelId,
  MODEL_PROVIDER_MAP,
  isGoogleModel,
  isOpenAIModel,
} from "@/lib/ai/providers";
import { getSystemPrompt } from "@/lib/ai/prompts";
import { db } from "@/lib/db";
import { patentDocuments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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
        "means_plus_function",
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
      patentId,
    } = await req.json();

    if (!inventionDescription) {
      return Response.json(
        { error: "Invention description is required to generate claims." },
        { status: 400 }
      );
    }

    const modelId = (model || "gemini-3.1-pro") as ModelId;
    if (!(modelId in MODEL_PROVIDER_MAP)) {
      return Response.json(
        { error: `Invalid model "${model}". Valid models: ${Object.keys(MODEL_PROVIDER_MAP).join(", ")}` },
        { status: 400 }
      );
    }

    if (isOpenAIModel(modelId) && !process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OpenAI API key is not configured. Go to Settings to check your API keys." },
        { status: 400 }
      );
    }
    if (isGoogleModel(modelId) && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return Response.json(
        { error: "Google AI API key is not configured. Go to Settings to check your API keys." },
        { status: 400 }
      );
    }

    const systemPrompt = getSystemPrompt("claims", jurisdiction || "US");
    const aiModel = getModel(modelId);

    let referenceText = "";
    if (patentId) {
      const docs = await db.query.patentDocuments.findMany({
        where: eq(patentDocuments.patentId, patentId),
      });
      referenceText = docs
        .filter((d) => d.extractedText && d.extractedText.trim().length > 0)
        .map((d) => `--- REFERENCE: ${d.fileName} ---\n${d.extractedText}`)
        .join("\n\n");
    }

    const promptParts = [
      `Invention Description:\n${inventionDescription}`,
      claimType && `Requested claim type: ${claimType}`,
      count && `Number of claims to generate: ${count}`,
      existingClaims?.length > 0 &&
        `Existing claims to build upon:\n${JSON.stringify(existingClaims, null, 2)}`,
      referenceText &&
        `REFERENCE DOCUMENTS (use as technical context):\n${referenceText.length > 30000 ? referenceText.slice(0, 30000) + "\n[...truncated...]" : referenceText}`,
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
