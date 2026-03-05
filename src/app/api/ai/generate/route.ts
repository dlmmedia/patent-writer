import { streamText } from "ai";
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

function buildSmartContext(
  sectionType: string,
  context: string | undefined,
  existingSections: Record<string, string> | undefined,
  referenceText?: string
): string {
  const parts: string[] = [];

  if (context) {
    parts.push(context);
  }

  if (referenceText && referenceText.trim().length > 0) {
    const truncated =
      referenceText.length > 30000
        ? referenceText.slice(0, 30000) + "\n[...truncated...]"
        : referenceText;
    parts.push(
      `\nREFERENCE DOCUMENTS (use these as technical context for drafting):\n${truncated}`
    );
  }

  if (existingSections && Object.keys(existingSections).length > 0) {
    const sectionContent = Object.entries(existingSections)
      .filter(
        ([type, content]) => type !== sectionType && content.trim().length > 0
      )
      .map(
        ([type, content]) =>
          `--- ${type.replace(/_/g, " ").toUpperCase()} ---\n${content}`
      )
      .join("\n\n");

    if (sectionContent) {
      parts.push(`\nAlready written sections:\n${sectionContent}`);
      parts.push(
        `\nGenerate the ${sectionType.replace(/_/g, " ")} section that is consistent with all content above. Do not repeat content already covered in other sections.`
      );
    }
  }

  return parts.join("\n");
}

export async function POST(req: Request) {
  try {
    const {
      sectionType,
      model,
      instructions,
      context,
      jurisdiction,
      existingSections,
      patentId,
    } = await req.json();

    const modelId = (model || "gemini-3.1-pro") as ModelId;
    if (!(modelId in MODEL_PROVIDER_MAP)) {
      return Response.json(
        {
          error: `Invalid model "${model}". Valid models: ${Object.keys(MODEL_PROVIDER_MAP).join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (isOpenAIModel(modelId) && !process.env.OPENAI_API_KEY) {
      return Response.json(
        {
          error:
            "OpenAI API key is not configured. Go to Settings to check your API keys.",
        },
        { status: 400 }
      );
    }
    if (isGoogleModel(modelId) && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return Response.json(
        {
          error:
            "Google AI API key is not configured. Go to Settings to check your API keys.",
        },
        { status: 400 }
      );
    }

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

    const systemPrompt = getSystemPrompt(sectionType, jurisdiction || "US");
    const aiModel = getModel(modelId);

    const smartContext = buildSmartContext(
      sectionType,
      context,
      existingSections,
      referenceText
    );

    const userPrompt = instructions
      ? `${smartContext}\n\nAdditional instructions:\n${instructions}`
      : smartContext ||
        `Generate the ${sectionType.replace(/_/g, " ")} section for this patent.`;

    const result = streamText({
      model: aiModel,
      system: systemPrompt,
      prompt: userPrompt,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Content generation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: `Failed to generate content: ${message}` },
      { status: 500 }
    );
  }
}
