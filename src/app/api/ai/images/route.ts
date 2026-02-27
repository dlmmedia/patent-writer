import { experimental_generateImage as generateImage } from "ai";
import { getImageModel, type ImageModelId, imageModels } from "@/lib/ai/providers";

export async function POST(req: Request) {
  try {
    const { prompt, model } = await req.json();

    if (!prompt) {
      return Response.json(
        { error: "A prompt is required to generate an image." },
        { status: 400 }
      );
    }

    const modelId = (model || "gpt-image-1") as ImageModelId;
    if (!(modelId in imageModels)) {
      return Response.json(
        { error: `Invalid image model "${model}". Valid models: ${Object.keys(imageModels).join(", ")}` },
        { status: 400 }
      );
    }

    const imageModel = getImageModel(modelId);

    const { image } = await generateImage({
      model: imageModel,
      prompt: `Patent drawing in black and white line art style. Clean technical illustration with numbered reference elements. No shading or color. Precise engineering-style lines. ${prompt}`,
      size: "1024x1024",
    });

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
