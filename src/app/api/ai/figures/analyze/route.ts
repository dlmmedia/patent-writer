import { generateObject } from "ai";
import { z } from "zod";
import {
  getModel,
  type ModelId,
  MODEL_PROVIDER_MAP,
  isGoogleModel,
  isOpenAIModel,
} from "@/lib/ai/providers";
import { getFigureAnalysisPrompt } from "@/lib/ai/prompts";
import { db } from "@/lib/db";
import { patents, patentSections } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export const figureAnalysisSchema = z.object({
  figures: z.array(
    z.object({
      figureNumber: z.string(),
      figureType: z.enum([
        "block_diagram",
        "flowchart",
        "system_architecture",
        "data_flow",
        "perspective_view",
        "cross_section",
        "detail_view",
        "ui_mockup",
      ]),
      label: z.string(),
      description: z.string(),
      referenceNumerals: z.array(
        z.object({
          numeral: z.number(),
          elementName: z.string(),
        })
      ),
    })
  ),
});

export type FigureAnalysis = z.infer<typeof figureAnalysisSchema>;

export async function POST(req: Request) {
  try {
    const { patentId, model } = await req.json();

    if (!patentId) {
      return Response.json({ error: "patentId is required" }, { status: 400 });
    }

    const modelId = (model || "gemini-3.1-pro") as ModelId;
    if (!(modelId in MODEL_PROVIDER_MAP)) {
      return Response.json(
        { error: `Invalid model "${model}".` },
        { status: 400 }
      );
    }

    if (isOpenAIModel(modelId) && !process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OpenAI API key is not configured." },
        { status: 400 }
      );
    }
    if (isGoogleModel(modelId) && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return Response.json(
        { error: "Google AI API key is not configured." },
        { status: 400 }
      );
    }

    const patent = await db.query.patents.findFirst({
      where: eq(patents.id, patentId),
      with: {
        sections: { orderBy: [asc(patentSections.orderIndex)] },
      },
    });

    if (!patent) {
      return Response.json({ error: "Patent not found" }, { status: 404 });
    }

    const context = buildAnalysisContext(patent);
    const aiModel = getModel(modelId);

    const result = await generateObject({
      model: aiModel,
      system: getFigureAnalysisPrompt(),
      prompt: context,
      schema: figureAnalysisSchema,
      abortSignal: AbortSignal.timeout(120_000),
    });

    return Response.json(result.object);
  } catch (error) {
    console.error("Figure analysis error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: `Failed to analyze figures: ${message}` },
      { status: 500 }
    );
  }
}

function buildAnalysisContext(patent: {
  title: string;
  inventionDescription: string | null;
  technologyArea: string | null;
  sections: { sectionType: string; plainText: string | null }[];
}): string {
  const parts: string[] = [];
  parts.push(`Patent Title: ${patent.title}`);
  if (patent.inventionDescription) {
    parts.push(`Invention Description: ${patent.inventionDescription}`);
  }
  if (patent.technologyArea) {
    parts.push(`Technology Area: ${patent.technologyArea}`);
  }

  const sectionOrder = [
    "summary",
    "detailed_description",
    "claims",
    "background",
    "field_of_invention",
  ];

  for (const sType of sectionOrder) {
    const section = patent.sections.find((s) => s.sectionType === sType);
    if (section?.plainText && section.plainText.trim().length > 20) {
      const label = sType.replace(/_/g, " ").toUpperCase();
      const text =
        section.plainText.length > 8000
          ? section.plainText.slice(0, 8000) + "\n[...truncated...]"
          : section.plainText;
      parts.push(`\n--- ${label} ---\n${text}`);
    }
  }

  parts.push(
    "\nBased on the patent content above, determine the optimal set of figures needed to illustrate this invention. Consider system diagrams, method flowcharts, component details, and any other views that would help a person skilled in the art understand the invention."
  );

  return parts.join("\n");
}
