import { generateImage } from "ai";
import {
  getImageModel,
  type ImageModelId,
  IMAGE_MODEL_PROVIDER_MAP,
  isGoogleImageModel,
  isOpenAIImageModel,
} from "@/lib/ai/providers";

export async function POST(req: Request) {
  try {
    const { prompt, model } = await req.json();

    if (!prompt) {
      return Response.json(
        { error: "A prompt is required to generate an image." },
        { status: 400 }
      );
    }

    const modelId = (model || "nano-banana-2") as ImageModelId;
    if (!(modelId in IMAGE_MODEL_PROVIDER_MAP)) {
      return Response.json(
        { error: `Invalid image model "${model}". Valid models: ${Object.keys(IMAGE_MODEL_PROVIDER_MAP).join(", ")}` },
        { status: 400 }
      );
    }

    if (isOpenAIImageModel(modelId) && !process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OpenAI API key is not configured. Go to Settings to check your API keys." },
        { status: 400 }
      );
    }
    if (isGoogleImageModel(modelId) && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return Response.json(
        { error: "Google AI API key is not configured. Go to Settings to check your API keys." },
        { status: 400 }
      );
    }

    const imageModel = getImageModel(modelId);

    const fullPrompt = `Patent drawing in black and white line art style. Clean technical illustration with numbered reference elements. No shading or color. Precise engineering-style lines. ${prompt}`;

    const generateOptions: Parameters<typeof generateImage>[0] = {
      model: imageModel,
      prompt: fullPrompt,
    };

    if (isOpenAIImageModel(modelId)) {
      generateOptions.size = "1024x1024";
    } else {
      generateOptions.aspectRatio = "1:1";
    }

    const { image } = await generateImage(generateOptions);

    return Response.json({ image: image.base64 });
  } catch (error) {
    console.error("Image generation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: `Failed to generate image: ${message}` },
      { status: 500 }
    );
  }
}
