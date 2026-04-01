import { put } from "@vercel/blob";

export async function uploadImageToBlob(
  base64: string,
  filename: string,
  contentType = "image/png"
): Promise<string> {
  const buffer = Buffer.from(base64, "base64");

  const { url } = await put(`patent-drawings/${filename}`, buffer, {
    access: "public",
    contentType,
    addRandomSuffix: true,
  });

  return url;
}
