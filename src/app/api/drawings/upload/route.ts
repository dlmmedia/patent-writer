import { uploadImageToBlob } from "@/lib/blob";

export async function POST(req: Request) {
  try {
    const { image, filename } = await req.json();

    if (!image) {
      return Response.json(
        { error: "Base64 image data is required." },
        { status: 400 }
      );
    }

    const name = filename || `upload-${Date.now()}.png`;
    const url = await uploadImageToBlob(image, name);

    return Response.json({ url });
  } catch (error) {
    console.error("Upload error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: `Upload failed: ${message}` },
      { status: 500 }
    );
  }
}
