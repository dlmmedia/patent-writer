import { generateObject } from "ai";
import { z } from "zod";
import { getModel, type ModelId, MODEL_PROVIDER_MAP, isGoogleModel, isOpenAIModel } from "@/lib/ai/providers";
import { getCompletenessReviewPrompt } from "@/lib/ai/prompts";
import { db } from "@/lib/db";
import { patents, patentSections, patentClaims, patentDrawings, referenceNumerals } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

const reviewSchema = z.object({
  overallScore: z.number().min(0).max(100),
  sectionScores: z.array(
    z.object({
      section: z.string(),
      score: z.number().min(0).max(100),
      status: z.enum(["complete", "adequate", "needs_work", "missing"]),
    })
  ),
  findings: z.array(
    z.object({
      severity: z.enum(["critical", "warning", "info"]),
      category: z.enum(["enablement", "written_description", "claim_scope", "prior_art_risk", "missing_embodiment", "formatting"]),
      title: z.string(),
      description: z.string(),
      suggestion: z.string(),
      affectedSection: z.string().optional(),
    })
  ),
  claimScopeOpportunities: z.array(z.string()),
  missingEmbodiments: z.array(z.string()),
  filingReadiness: z.enum(["ready", "needs_minor_revisions", "needs_major_revisions", "not_ready"]),
});

export async function POST(req: Request) {
  try {
    const { patentId, model } = await req.json();

    if (!patentId) {
      return Response.json({ error: "patentId is required" }, { status: 400 });
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

    const patent = await db.query.patents.findFirst({
      where: eq(patents.id, patentId),
      with: {
        sections: { orderBy: [asc(patentSections.orderIndex)] },
        claims: { orderBy: [asc(patentClaims.claimNumber)] },
        drawings: { orderBy: [asc(patentDrawings.figureNumber)] },
        referenceNumerals: { orderBy: [asc(referenceNumerals.numeral)] },
      },
    });

    if (!patent) {
      return Response.json({ error: "Patent not found" }, { status: 404 });
    }

    const contextParts: string[] = [];
    contextParts.push(`Title: ${patent.title}`);
    contextParts.push(`Type: ${patent.type}`);
    contextParts.push(`Jurisdiction: ${patent.jurisdiction}`);
    if (patent.technologyArea) contextParts.push(`Technology: ${patent.technologyArea}`);
    if (patent.inventionDescription) contextParts.push(`Description: ${patent.inventionDescription}`);

    for (const section of patent.sections) {
      if (section.plainText && section.plainText.trim().length > 0) {
        const label = section.sectionType.replace(/_/g, " ").toUpperCase();
        const content = section.plainText.length > 5000
          ? section.plainText.slice(0, 5000) + "\n[...truncated...]"
          : section.plainText;
        contextParts.push(`\n--- ${label} ---\n${content}`);
      }
    }

    if (patent.claims.length > 0) {
      contextParts.push(`\n--- CLAIMS (${patent.claims.length} total) ---`);
      for (const claim of patent.claims.slice(0, 20)) {
        contextParts.push(`${claim.claimNumber}. ${claim.fullText}`);
      }
    }

    contextParts.push(`\nDrawings: ${patent.drawings.length} figures`);
    contextParts.push(`Reference Numerals: ${patent.referenceNumerals.length}`);

    const result = await generateObject({
      model: getModel(modelId),
      system: getCompletenessReviewPrompt(),
      prompt: contextParts.join("\n"),
      schema: reviewSchema,
    });

    return Response.json(result.object);
  } catch (error) {
    console.error("Review error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
