import { generateObject } from "ai";
import { z } from "zod";
import {
  getModel,
  type ModelId,
  MODEL_PROVIDER_MAP,
  isGoogleModel,
  isOpenAIModel,
} from "@/lib/ai/providers";

const searchKeywordsSchema = z.object({
  keywordGroups: z.array(
    z.object({
      category: z.string(),
      description: z.string(),
      keywords: z.array(z.string()),
    })
  ),
  suggestedQueries: z.array(
    z.object({
      description: z.string(),
      queryString: z.string(),
      targetFields: z.array(z.string()),
    })
  ),
  searchStrategy: z.object({
    passes: z.array(
      z.object({
        name: z.string(),
        description: z.string(),
        queries: z.array(z.string()),
      })
    ),
  }),
  substituteTerms: z.array(
    z.object({
      original: z.string(),
      substitutes: z.array(z.string()),
    })
  ),
});

export type SearchKeywordsResult = z.infer<typeof searchKeywordsSchema>;

export async function POST(req: Request) {
  try {
    const { model, inventionDescription, cpcCodes, keyFeatures, jurisdiction } =
      await req.json();

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
      contextParts.push(`\nCPC Codes assigned to this invention: ${cpcCodes.join(", ")}`);
    }
    if (keyFeatures && keyFeatures.length > 0) {
      contextParts.push(
        `\nKey Features:\n${keyFeatures.map((f: { feature: string; description?: string }) => `- ${f.feature}${f.description ? ": " + f.description : ""}`).join("\n")}`
      );
    }

    const result = await generateObject({
      model: aiModel,
      system: `You are a senior patent search strategist with deep expertise in USPTO prior art searching, CPC classification, and patent prosecution.

Given an invention description, generate a comprehensive prior art search keyword strategy. Your output must help a patent practitioner systematically search USPTO Patent Public Search and EPO Espacenet for relevant prior art.

KEYWORD GROUPS: Generate 7-10 thematic keyword groups organized by category. Each group should contain 8-15 terms. Categories must include:
1. Core concept / transformation terms - primary technical terms describing the invention
2. Semantic / structure terms - terms related to the structural or semantic aspects
3. Process / method terms - terms for the methods, steps, or processes involved
4. Component / system terms - hardware, software, or system architecture terms
5. Industry-specific terms - domain jargon and industry-standard terminology
6. Alternate / synonym terms - older or equivalent terms that prior art may use instead
7. CPC-aligned terms - terms that align with CPC classification descriptions
Include additional categories as relevant to the invention.

SUGGESTED QUERIES: Generate 8-12 paste-ready search query strings using Boolean operators (AND, OR) and proximity operators. These should be formatted for USPTO Patent Public Search Advanced Search. Include field codes like .AB. (abstract), .CLM. (claims), .SPEC. (specification), .TI. (title).

SEARCH STRATEGY: Organize searches into a 3-pass strategy:
- Pass 1: CPC-only scan (run each CPC code alone to measure bucket density)
- Pass 2: CPC + novelty terms (layer in invention-specific keywords with CPC filters)
- Pass 3: Citation mining (use closest results to expand search via cited references)

SUBSTITUTE TERMS: Provide a mapping of invention-specific terms to older or alternate terms that prior art may use. Prior art often uses different vocabulary from modern descriptions.

${jurisdiction ? `Target jurisdiction: ${jurisdiction}.` : "Focus on US patent searching conventions."}

Be thorough and practical. The goal is to ensure no relevant prior art is missed.`,
      prompt: contextParts.join("\n"),
      schema: searchKeywordsSchema,
    });

    return Response.json(result.object);
  } catch (error) {
    console.error("Search keywords generation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: `Failed to generate search keywords: ${message}` },
      { status: 500 }
    );
  }
}
