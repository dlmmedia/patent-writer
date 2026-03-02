import { streamText } from "ai";
import { getModel, type ModelId, models } from "@/lib/ai/providers";
import { getSystemPrompt } from "@/lib/ai/prompts";

export async function POST(req: Request) {
  try {
    const { sectionType, model, instructions, context, jurisdiction } =
      await req.json();

    const modelId = (model || "gemini-2.5-flash") as ModelId;
    if (!(modelId in models)) {
      return Response.json(
        { error: `Invalid model "${model}". Valid models: ${Object.keys(models).join(", ")}` },
        { status: 400 }
      );
    }

    const isOpenAI = modelId.startsWith("gpt") || modelId === "o3";
    const isGoogle = modelId.startsWith("gemini");
    if (isOpenAI && !process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OpenAI API key is not configured. Go to Settings to check your API keys." },
        { status: 400 }
      );
    }
    if (isGoogle && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return Response.json(
        { error: "Google AI API key is not configured. Go to Settings to check your API keys." },
        { status: 400 }
      );
    }

    const systemPrompt = getSystemPrompt(sectionType, jurisdiction || "US");
    const aiModel = getModel(modelId);

    const result = streamText({
      model: aiModel,
      system: systemPrompt,
      prompt: `${context ? `Context about the invention:\n${context}\n\n` : ""}${instructions || `Generate the ${sectionType.replace(/_/g, " ")} section for this patent.`}`,
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
