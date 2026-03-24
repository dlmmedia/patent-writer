export const maxDuration = 300;

import { streamText, generateObject, generateImage } from "ai";
import { z } from "zod";
import {
  getModel,
  getImageModel,
  type ModelId,
  type ImageModelId,
  MODEL_PROVIDER_MAP,
  IMAGE_MODEL_PROVIDER_MAP,
  isGoogleModel,
  isOpenAIModel,
  isOpenAIImageModel,
} from "@/lib/ai/providers";
import { getSystemPrompt, getFigureAnalysisPrompt, getBriefDescriptionWithFiguresPrompt, buildEnhancedContext } from "@/lib/ai/prompts";
import { db } from "@/lib/db";
import { patents, patentSections, patentClaims, patentDocuments, patentDrawings, referenceNumerals, priorArtResults } from "@/lib/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { figureAnalysisSchema } from "@/app/api/ai/figures/analyze/route";
import type { KeyFeature, IntakeQA } from "@/lib/db/schema";

const GENERATION_ORDER = [
  "title",
  "cross_reference",
  "field_of_invention",
  "background",
  "summary",
  "brief_description_drawings",
  "claims",
  "detailed_description",
  "abstract",
] as const;

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

function buildSectionContext(
  generatedSections: Record<string, string>,
  patent: {
    title: string;
    inventionDescription: string | null;
    inventionProblem?: string | null;
    inventionSolution?: string | null;
    technologyArea?: string | null;
    keyFeatures?: KeyFeature[] | null;
    knownPriorArt?: string | null;
    intakeResponses?: IntakeQA[] | null;
    jurisdiction: string;
    type: string;
  },
  referenceText?: string,
  priorArt?: { title: string; abstract?: string | null; relevanceScore?: number | null }[]
): string {
  return buildEnhancedContext({
    title: patent.title,
    inventionDescription: patent.inventionDescription || undefined,
    inventionProblem: patent.inventionProblem || undefined,
    inventionSolution: patent.inventionSolution || undefined,
    technologyArea: patent.technologyArea || undefined,
    keyFeatures: (patent.keyFeatures as KeyFeature[]) || undefined,
    knownPriorArt: patent.knownPriorArt || undefined,
    intakeResponses: (patent.intakeResponses as IntakeQA[]) || undefined,
    priorArtResults: priorArt?.map((pa) => ({
      title: pa.title,
      abstract: pa.abstract || undefined,
      relevanceScore: pa.relevanceScore || undefined,
    })),
    jurisdiction: patent.jurisdiction,
    patentType: patent.type,
    generatedSections,
    referenceText,
  });
}

export async function POST(req: Request) {
  try {
    const { patentId, model, skipExisting, generateFigures, imageModel } = await req.json();

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
        claims: { orderBy: [asc(patentClaims.claimNumber)] },
        documents: true,
      },
    });

    if (!patent) {
      return Response.json({ error: "Patent not found" }, { status: 404 });
    }

    const referenceText = (patent.documents || [])
      .filter((d) => d.extractedText && d.extractedText.trim().length > 0)
      .map((d) => `--- REFERENCE: ${d.fileName} ---\n${d.extractedText}`)
      .join("\n\n");

    // Fetch saved prior art results for context
    const savedPriorArt = await db.query.priorArtResults.findMany({
      where: eq(priorArtResults.patentId, patentId),
      orderBy: [desc(priorArtResults.relevanceScore)],
      limit: 15,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function send(event: string, data: unknown) {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        }

        const generatedSections: Record<string, string> = {};

        for (const section of patent.sections) {
          const existing = section.plainText?.trim();
          if (existing && existing.length > 10) {
            generatedSections[section.sectionType] = existing;
          }
        }

        const sectionsToGenerate = GENERATION_ORDER.filter((sectionType) => {
          const section = patent.sections.find(
            (s) => s.sectionType === sectionType
          );
          if (!section) return false;
          if (sectionType === "claims") return true;
          if (skipExisting !== false) {
            const existing = section.plainText?.trim();
            if (existing && existing.length > 10) return false;
          }
          return true;
        });

        send("start", {
          totalSections: sectionsToGenerate.length,
          sections: sectionsToGenerate,
        });

        const aiModel = getModel(modelId);

        for (const sectionType of sectionsToGenerate) {
          const section = patent.sections.find(
            (s) => s.sectionType === sectionType
          );
          if (!section) continue;

          send("section_start", { section: sectionType });

          try {
            if (sectionType === "claims") {
              const existingClaims = patent.claims;
              if (existingClaims.length > 0 && skipExisting !== false) {
                const claimsText = existingClaims
                  .map((c) => c.fullText)
                  .join("\n\n");
                generatedSections.claims = claimsText;
                send("section_complete", {
                  section: sectionType,
                  content: claimsText,
                  skipped: true,
                });
                continue;
              }

              const context = buildSectionContext(
                generatedSections,
                patent,
                referenceText,
                savedPriorArt
              );

              const claimsResult = await generateObject({
                model: aiModel,
                system: getSystemPrompt("claims", patent.jurisdiction),
                prompt: `${context}\n\nGenerate a comprehensive set of patent claims (3 independent + dependent claims, approximately 15-20 total). Include method, system, and apparatus claim types.`,
                schema: claimSchema,
                abortSignal: AbortSignal.timeout(120_000),
              });

              await db
                .delete(patentClaims)
                .where(eq(patentClaims.patentId, patentId));

              const insertedClaims: { claimNumber: number; id: string }[] = [];

              for (const claim of claimsResult.object.claims) {
                let parentClaimId: string | undefined;
                if (
                  claim.parentClaimNumber &&
                  !claim.isIndependent
                ) {
                  const parent = insertedClaims.find(
                    (c) => c.claimNumber === claim.parentClaimNumber
                  );
                  if (parent) parentClaimId = parent.id;
                }

                const [inserted] = await db
                  .insert(patentClaims)
                  .values({
                    patentId,
                    claimNumber: claim.claimNumber,
                    claimType: claim.claimType,
                    isIndependent: claim.isIndependent,
                    parentClaimId: parentClaimId,
                    transitionalPhrase: claim.transitionalPhrase,
                    preamble: claim.preamble,
                    body: claim.body,
                    fullText: claim.fullText,
                  })
                  .returning({ id: patentClaims.id, claimNumber: patentClaims.claimNumber });

                insertedClaims.push(inserted);
              }

              const claimsText = claimsResult.object.claims
                .map((c) => `${c.claimNumber}. ${c.fullText}`)
                .join("\n\n");
              generatedSections.claims = claimsText;

              const sectionPlainText = claimsText;
              await db
                .update(patentSections)
                .set({
                  plainText: sectionPlainText,
                  content: [
                    {
                      type: "p",
                      children: [{ text: sectionPlainText }],
                    },
                  ] as unknown as Record<string, unknown>,
                  wordCount: sectionPlainText
                    .split(/\s+/)
                    .filter(Boolean).length,
                  isAiGenerated: true,
                  generationModel: modelId,
                  updatedAt: new Date(),
                })
                .where(eq(patentSections.id, section.id));

              send("section_complete", {
                section: sectionType,
                content: claimsText,
                claimsCount: claimsResult.object.claims.length,
              });
              continue;
            }

            const context = buildSectionContext(
              generatedSections,
              patent,
              referenceText,
              savedPriorArt
            );

            const systemPrompt = getSystemPrompt(
              sectionType,
              patent.jurisdiction,
              patent.type
            );

            const result = streamText({
              model: aiModel,
              system: systemPrompt,
              prompt: context,
              abortSignal: AbortSignal.timeout(120_000),
            });

            let accumulated = "";
            for await (const chunk of result.textStream) {
              accumulated += chunk;
              send("section_progress", {
                section: sectionType,
                chunk,
              });
            }

            generatedSections[sectionType] = accumulated;

            const contentNodes = accumulated
              .split(/\n\n+/)
              .filter((p) => p.trim())
              .map((p) => ({
                type: "p" as const,
                children: [{ text: p.trim() }],
              }));

            await db
              .update(patentSections)
              .set({
                content:
                  contentNodes.length > 0
                    ? (contentNodes as unknown as Record<string, unknown>)
                    : ([
                        { type: "p", children: [{ text: accumulated }] },
                      ] as unknown as Record<string, unknown>),
                plainText: accumulated,
                wordCount: accumulated.split(/\s+/).filter(Boolean).length,
                isAiGenerated: true,
                generationModel: modelId,
                updatedAt: new Date(),
              })
              .where(eq(patentSections.id, section.id));

            send("section_complete", {
              section: sectionType,
              content: accumulated,
            });
          } catch (err) {
            console.error(`Section ${sectionType} generation error:`, err);
            const errorDetail = extractErrorDetail(err);
            send("section_error", {
              section: sectionType,
              error: errorDetail.message,
              statusCode: errorDetail.statusCode,
            });
          }
        }

        // ─── Figure Analysis & Generation Phase ────────────────
        if (generateFigures !== false) {
          try {
            send("figures_analyzing", { message: "Analyzing required figures..." });

            const figureContext = buildFigureAnalysisContext(
              patent,
              generatedSections
            );

            const figureResult = await generateObject({
              model: aiModel,
              system: getFigureAnalysisPrompt(),
              prompt: figureContext,
              schema: figureAnalysisSchema,
              abortSignal: AbortSignal.timeout(120_000),
            });

            const figures = figureResult.object.figures;

            if (figures.length > 0) {
              send("figures_start", {
                total: figures.length,
                figures: figures.map((f) => ({
                  figureNumber: f.figureNumber,
                  label: f.label,
                  figureType: f.figureType,
                })),
              });

              // Clear existing drawings before generating new ones
              await db
                .delete(referenceNumerals)
                .where(eq(referenceNumerals.patentId, patentId));
              await db
                .delete(patentDrawings)
                .where(eq(patentDrawings.patentId, patentId));

              const imgModelId = (imageModel || patent.aiModelConfig?.imageModel || "nano-banana-2") as ImageModelId;
              const hasImageModel = imgModelId in IMAGE_MODEL_PROVIDER_MAP;

              if (hasImageModel) {
                const imgModel = getImageModel(imgModelId);

                const generateFigure = async (figure: typeof figures[number]) => {
                  send("figure_generating", {
                    figureNumber: figure.figureNumber,
                    label: figure.label,
                    figureType: figure.figureType,
                  });

                  try {
                    const prompt = buildImagePrompt(figure);

                    const generateOptions: Parameters<typeof generateImage>[0] = {
                      model: imgModel,
                      prompt,
                      abortSignal: AbortSignal.timeout(120_000),
                    };

                    if (isOpenAIImageModel(imgModelId)) {
                      generateOptions.size = "1024x1024";
                    } else {
                      generateOptions.aspectRatio = "1:1";
                    }

                    const { image } = await generateImage(generateOptions);
                    const dataUrl = `data:image/png;base64,${image.base64}`;

                    const [drawing] = await db
                      .insert(patentDrawings)
                      .values({
                        patentId,
                        figureNumber: figure.figureNumber,
                        figureLabel: figure.label,
                        description: figure.description,
                        originalUrl: dataUrl,
                        generationPrompt: prompt,
                        generationModel: imgModelId,
                        width: 1024,
                        height: 1024,
                        dpi: 300,
                      })
                      .returning();

                    if (figure.referenceNumerals.length > 0) {
                      await db.insert(referenceNumerals).values(
                        figure.referenceNumerals.map((rn) => ({
                          patentId,
                          numeral: rn.numeral,
                          elementName: rn.elementName,
                          firstFigureId: drawing.id,
                        }))
                      );
                    }

                    send("figure_complete", {
                      figureNumber: figure.figureNumber,
                      label: figure.label,
                      drawingId: drawing.id,
                    });
                  } catch (err) {
                    const errorDetail = extractErrorDetail(err);
                    send("figure_error", {
                      figureNumber: figure.figureNumber,
                      label: figure.label,
                      error: errorDetail.message,
                      statusCode: errorDetail.statusCode,
                    });
                  }
                };

                await runWithConcurrency(figures, generateFigure, 3);
              }

              send("figures_complete", { message: "All figures generated" });

              // ─── Regenerate Brief Description of Drawings ────────
              const briefSection = patent.sections.find(
                (s) => s.sectionType === "brief_description_drawings"
              );

              if (briefSection) {
                try {
                  send("section_start", { section: "brief_description_drawings" });

                  const briefPrompt = getBriefDescriptionWithFiguresPrompt(figures);
                  const briefContext = buildSectionContext(
                    generatedSections,
                    patent,
                    referenceText,
                    savedPriorArt
                  );

                  const briefResult = streamText({
                    model: aiModel,
                    system: briefPrompt,
                    prompt: briefContext,
                    abortSignal: AbortSignal.timeout(120_000),
                  });

                  let briefAccumulated = "";
                  for await (const chunk of briefResult.textStream) {
                    briefAccumulated += chunk;
                    send("section_progress", {
                      section: "brief_description_drawings",
                      chunk,
                    });
                  }

                  generatedSections["brief_description_drawings"] = briefAccumulated;

                  const briefNodes = briefAccumulated
                    .split(/\n\n+/)
                    .filter((p) => p.trim())
                    .map((p) => ({
                      type: "p" as const,
                      children: [{ text: p.trim() }],
                    }));

                  await db
                    .update(patentSections)
                    .set({
                      content:
                        briefNodes.length > 0
                          ? (briefNodes as unknown as Record<string, unknown>)
                          : ([{ type: "p", children: [{ text: briefAccumulated }] }] as unknown as Record<string, unknown>),
                      plainText: briefAccumulated,
                      wordCount: briefAccumulated.split(/\s+/).filter(Boolean).length,
                      isAiGenerated: true,
                      generationModel: modelId,
                      updatedAt: new Date(),
                    })
                    .where(eq(patentSections.id, briefSection.id));

                  send("section_complete", {
                    section: "brief_description_drawings",
                    content: briefAccumulated,
                  });
                } catch (err) {
                  const message =
                    err instanceof Error ? err.message : "Unknown error";
                  send("section_error", {
                    section: "brief_description_drawings",
                    error: message,
                  });
                }
              }
            }
          } catch (err) {
            console.error("Figure analysis/generation error:", err);
            const errorDetail = extractErrorDetail(err);
            send("figure_error", {
              figureNumber: "all",
              label: "Figure analysis",
              error: errorDetail.message,
              statusCode: errorDetail.statusCode,
            });
          }
        }

        send("complete", { message: "All sections generated" });
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Generate-all error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: `Failed to generate: ${message}` },
      { status: 500 }
    );
  }
}

function buildFigureAnalysisContext(
  patent: {
    title: string;
    inventionDescription: string | null;
    technologyArea: string | null;
    sections: { sectionType: string; plainText: string | null }[];
  },
  generatedSections: Record<string, string>
): string {
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
    const text = generatedSections[sType]
      || patent.sections.find((s) => s.sectionType === sType)?.plainText;
    if (text && text.trim().length > 20) {
      const label = sType.replace(/_/g, " ").toUpperCase();
      const truncated =
        text.length > 8000 ? text.slice(0, 8000) + "\n[...truncated...]" : text;
      parts.push(`\n--- ${label} ---\n${truncated}`);
    }
  }

  parts.push(
    "\nBased on the patent content above, determine the optimal set of figures needed to illustrate this invention."
  );

  return parts.join("\n");
}

async function runWithConcurrency<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  limit: number
): Promise<void> {
  const executing = new Set<Promise<void>>();
  for (const item of items) {
    const p = fn(item).finally(() => executing.delete(p));
    executing.add(p);
    if (executing.size >= limit) await Promise.race(executing);
  }
  await Promise.allSettled([...executing]);
}

function extractErrorDetail(err: unknown): { message: string; statusCode?: number } {
  if (!(err instanceof Error)) return { message: String(err) };
  const e = err as Error & { statusCode?: number; responseBody?: unknown; url?: string; cause?: unknown };
  let message = err.message;
  if (e.statusCode) {
    message = `[${e.statusCode}] ${message}`;
  }
  if (e.responseBody) {
    const body = typeof e.responseBody === "string" ? e.responseBody : JSON.stringify(e.responseBody);
    console.error("AI API response body:", body.substring(0, 2000));
  }
  return { message: message.substring(0, 500), statusCode: e.statusCode };
}

function buildImagePrompt(figure: {
  figureNumber: string;
  figureType: string;
  label: string;
  description: string;
  referenceNumerals: { numeral: number; elementName: string }[];
}): string {
  const typeLabels: Record<string, string> = {
    block_diagram: "Block Diagram",
    flowchart: "Flowchart",
    system_architecture: "System Architecture Diagram",
    data_flow: "Data Flow Diagram",
    perspective_view: "Perspective View",
    cross_section: "Cross-Section View",
    detail_view: "Detail View",
    ui_mockup: "User Interface Mockup",
  };

  const typeLabel = typeLabels[figure.figureType] || figure.figureType.replace(/_/g, " ");

  let prompt = `Patent drawing in black and white line art style. Clean technical illustration with numbered reference elements. No shading or color. Precise engineering-style lines.`;
  prompt += ` ${typeLabel} showing: ${figure.description}`;

  if (figure.referenceNumerals.length > 0) {
    const numeralList = figure.referenceNumerals
      .map((rn) => `${rn.numeral} - ${rn.elementName}`)
      .join(", ");
    prompt += ` Include labeled reference numerals: ${numeralList}.`;
  }

  prompt += ` Title: FIG. ${figure.figureNumber} - ${figure.label}`;

  return prompt;
}
