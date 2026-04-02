import { generateImage } from "ai";
import {
  getImageModel,
  type ImageModelId,
  IMAGE_MODEL_PROVIDER_MAP,
  isGoogleImageModel,
  isOpenAIImageModel,
} from "@/lib/ai/providers";
import { uploadImageToBlob } from "@/lib/blob";
import { buildEditPrompt } from "@/lib/ai/drawing-prompts";

export async function POST(req: Request) {
  try {
    const { sourceImage, editPrompt, model, originalDescription } =
      await req.json();

    if (!sourceImage) {
      return Response.json(
        { error: "A source image (base64) is required." },
        { status: 400 }
      );
    }
    if (!editPrompt) {
      return Response.json(
        { error: "An edit prompt is required." },
        { status: 400 }
      );
    }

    const modelId = (model || "gpt-image-1") as ImageModelId;
    if (!(modelId in IMAGE_MODEL_PROVIDER_MAP)) {
      return Response.json(
        {
          error: `Invalid image model "${model}". Valid models: ${Object.keys(IMAGE_MODEL_PROVIDER_MAP).join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (isOpenAIImageModel(modelId) && !process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OpenAI API key is not configured." },
        { status: 400 }
      );
    }
    if (
      isGoogleImageModel(modelId) &&
      !process.env.GOOGLE_GENERATIVE_AI_API_KEY
    ) {
      return Response.json(
        { error: "Google AI API key is not configured." },
        { status: 400 }
      );
    }

    const imageModel = getImageModel(modelId);
    const fullPrompt = buildEditPrompt(editPrompt, originalDescription);
    const sourceBuffer = Buffer.from(sourceImage, "base64");

    const generateOptions: Parameters<typeof generateImage>[0] = {
      model: imageModel,
      prompt: isOpenAIImageModel(modelId)
        ? { text: fullPrompt, images: [sourceBuffer] }
        : fullPrompt,
      abortSignal: AbortSignal.timeout(120_000),
    };

    if (isOpenAIImageModel(modelId)) {
      generateOptions.size = "1024x1024";
    } else {
      generateOptions.aspectRatio = "1:1";
    }

    const { image } = await generateImage(generateOptions);

    let url: string | undefined;
    try {
      const filename = `drawing-edit-${Date.now()}.png`;
      url = await uploadImageToBlob(image.base64, filename);
    } catch (blobErr) {
      console.error("Blob upload failed, returning base64 data URL:", blobErr);
    }

    return Response.json({
      image: image.base64,
      url: url ?? `data:image/png;base64,${image.base64}`,
    });
  } catch (error) {
    console.error("Image edit error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: `Failed to edit image: ${message}` },
      { status: 500 }
    );
  }
}
