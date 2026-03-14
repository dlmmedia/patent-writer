export const maxDuration = 300;

import { generateImage } from "ai";
import {
  getImageModel,
  type ImageModelId,
  IMAGE_MODEL_PROVIDER_MAP,
  isOpenAIImageModel,
  isGoogleImageModel,
} from "@/lib/ai/providers";
import { db } from "@/lib/db";
import { patentDrawings, referenceNumerals } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface FigureSpec {
  figureNumber: string;
  figureType: string;
  label: string;
  description: string;
  referenceNumerals: { numeral: number; elementName: string }[];
}

function buildImagePrompt(figure: FigureSpec): string {
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

export async function POST(req: Request) {
  try {
    const { patentId, figures, imageModel, clearExisting } = (await req.json()) as {
      patentId: string;
      figures: FigureSpec[];
      imageModel?: string;
      clearExisting?: boolean;
    };

    if (!patentId || !figures || figures.length === 0) {
      return Response.json(
        { error: "patentId and figures array are required" },
        { status: 400 }
      );
    }

    const modelId = (imageModel || "nano-banana-2") as ImageModelId;
    if (!(modelId in IMAGE_MODEL_PROVIDER_MAP)) {
      return Response.json(
        { error: `Invalid image model "${imageModel}".` },
        { status: 400 }
      );
    }

    if (isOpenAIImageModel(modelId) && !process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OpenAI API key is not configured." },
        { status: 400 }
      );
    }
    if (isGoogleImageModel(modelId) && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return Response.json(
        { error: "Google AI API key is not configured." },
        { status: 400 }
      );
    }

    if (clearExisting) {
      await db
        .delete(referenceNumerals)
        .where(eq(referenceNumerals.patentId, patentId));
      await db
        .delete(patentDrawings)
        .where(eq(patentDrawings.patentId, patentId));
    }

    const imgModel = getImageModel(modelId);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        function send(event: string, data: unknown) {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        }

        send("figures_start", { total: figures.length });

        const generateFigure = async (figure: FigureSpec) => {
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

            if (isOpenAIImageModel(modelId)) {
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
                generationModel: modelId,
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
            const message =
              err instanceof Error ? err.message : "Unknown error";
            send("figure_error", {
              figureNumber: figure.figureNumber,
              label: figure.label,
              error: message,
            });
          }
        };

        await runWithConcurrency(figures, generateFigure, 3);

        send("figures_complete", { message: "All figures generated" });
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
    console.error("Figure generation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: `Failed to generate figures: ${message}` },
      { status: 500 }
    );
  }
}
