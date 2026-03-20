import { generateObject } from "ai";
import { z } from "zod";
import {
  getModel,
  type ModelId,
  MODEL_PROVIDER_MAP,
  isGoogleModel,
  isOpenAIModel,
} from "@/lib/ai/providers";

const searchMatrixSchema = z.object({
  cpcEntries: z.array(
    z.object({
      cpcCode: z.string(),
      plainEnglishFocus: z.string(),
      keywords: z.array(z.string()),
      starterQueries: z.array(z.string()),
      relevanceRanking: z.number().min(1).max(10),
      reclassificationNotes: z.string().optional(),
    })
  ),
  combinedQueries: z.array(
    z.object({
      description: z.string(),
      queryString: z.string(),
    })
  ),
  searchWorkflow: z.object({
    passes: z.array(
      z.object({
        step: z.number(),
        name: z.string(),
        description: z.string(),
        whatToLookFor: z.string(),
        queries: z.array(z.string()),
      })
    ),
  }),
  strongestTerms: z.object({
    structureTerms: z.array(z.string()),
    conversionTerms: z.array(z.string()),
    cleanupTerms: z.array(z.string()),
    inputFormatTerms: z.array(z.string()),
  }),
  priorArtRiskAreas: z.array(
    z.object({
      area: z.string(),
      description: z.string(),
      likelyCpcCodes: z.array(z.string()),
    })
  ),
});

export type SearchMatrixResult = z.infer<typeof searchMatrixSchema>;

export async function POST(req: Request) {
  try {
    const {
      model,
      inventionDescription,
      cpcCodes,
      keyFeatures,
      technicalField,
      jurisdiction,
    } = await req.json();

    if (!inventionDescription) {
      return Response.json(
        { error: "Invention description is required." },
        { status: 400 }
      );
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

    const aiModel = getModel(modelId);

    const contextParts: string[] = [
      `Invention Description:\n${inventionDescription}`,
    ];
    if (cpcCodes && cpcCodes.length > 0) {
      contextParts.push(`\nCPC Codes: ${cpcCodes.join(", ")}`);
    }
    if (keyFeatures && keyFeatures.length > 0) {
      contextParts.push(
        `\nKey Features:\n${keyFeatures.map((f: { feature: string; description?: string }) => `- ${f.feature}${f.description ? ": " + f.description : ""}`).join("\n")}`
      );
    }
    if (technicalField) {
      contextParts.push(`\nTechnical Field: ${technicalField}`);
    }

    const result = await generateObject({
      model: aiModel,
      system: `You are an expert patent searcher specializing in CPC classification and USPTO/EPO prior art searching.

Given an invention description and its CPC codes, generate a comprehensive CPC Search Matrix suitable for a professional prior art review.

CPC ENTRIES: For each CPC code (both provided and any additional codes you recommend), provide:
- The CPC code itself
- A plain-English description of what the code covers and why it is relevant
- Best keywords to pair with it for searching
- Paste-ready starter queries in USPTO Patent Public Search format using field codes (.AB., .CLM., .SPEC., .TI., .CPC.)
- A relevance ranking from 1-10 (10 being most relevant)
- Any reclassification notes (e.g., codes that were split or merged by USPTO)

If the provided CPC codes are insufficient, suggest additional codes. Include at least 6 CPC entries.

COMBINED QUERIES: Generate 6-8 powerful combined search strings that span multiple CPC codes and capture the invention's key novelty aspects.

SEARCH WORKFLOW: Create a 3-pass search strategy:
- Pass 1: CPC-only scan - run each CPC code alone to measure bucket density, note recurring assignees and terminology
- Pass 2: CPC + novelty terms - layer in the invention's specific novelty themes
- Pass 3: Citation mining - use closest found patents to expand via their CPC codes, abstract language, and cited references

STRONGEST TERMS: Categorize the most powerful search terms into:
- Structure terms (document/data structure vocabulary)
- Conversion terms (transformation/processing vocabulary)
- Cleanup terms (simplification/normalization vocabulary)
- Input format terms (source format vocabulary)

PRIOR ART RISK AREAS: Identify 3-5 areas where the closest prior art is most likely to appear, with descriptions and likely CPC codes.

${jurisdiction ? `Target jurisdiction: ${jurisdiction}.` : "Focus on US patent searching with USPTO conventions."}

Be extremely thorough. This matrix will be used by patent practitioners to conduct a comprehensive prior art search. Use proper USPTO Patent Public Search syntax with Boolean operators (AND, OR, NOT) and proximity operators (SAME, NEAR, ADJ).`,
      prompt: contextParts.join("\n"),
      schema: searchMatrixSchema,
    });

    return Response.json(result.object);
  } catch (error) {
    console.error("Search matrix generation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: `Failed to generate search matrix: ${message}` },
      { status: 500 }
    );
  }
}
