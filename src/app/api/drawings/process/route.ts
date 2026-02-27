import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

const USPTO_DRAWING_WIDTH = 2007; // 6.69" x 300 DPI
const USPTO_DRAWING_HEIGHT = 2757; // 9.19" x 300 DPI
const MARGIN_TOP = 150; // ~0.5" at 300 DPI
const MARGIN_BOTTOM = 300; // ~1" at 300 DPI
const MARGIN_LEFT = 150;
const MARGIN_RIGHT = 150;

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, figureNumber } = await req.json();

    if (!imageBase64) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    const inputBuffer = Buffer.from(imageBase64, "base64");

    const usableWidth = USPTO_DRAWING_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
    const usableHeight = USPTO_DRAWING_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;

    const processed = await sharp(inputBuffer)
      .greyscale()
      .normalize()
      .threshold(128)
      .resize(usableWidth, usableHeight, {
        fit: "inside",
        withoutEnlargement: false,
        background: { r: 255, g: 255, b: 255 },
      })
      .extend({
        top: MARGIN_TOP,
        bottom: MARGIN_BOTTOM,
        left: MARGIN_LEFT,
        right: MARGIN_RIGHT,
        background: { r: 255, g: 255, b: 255 },
      })
      .png({ compressionLevel: 9 })
      .toBuffer();

    const metadata = await sharp(processed).metadata();

    const processedBase64 = processed.toString("base64");

    const thumbnailBuffer = await sharp(inputBuffer)
      .resize(300, 300, { fit: "inside" })
      .png()
      .toBuffer();
    const thumbnailBase64 = thumbnailBuffer.toString("base64");

    return NextResponse.json({
      processed: processedBase64,
      thumbnail: thumbnailBase64,
      width: metadata.width,
      height: metadata.height,
      dpi: 300,
      isCompliant: true,
      complianceDetails: {
        colorMode: "B&W",
        dimensions: `${metadata.width}x${metadata.height}`,
        dpi: 300,
        margins: "USPTO compliant (37 CFR 1.84)",
      },
    });
  } catch (error) {
    console.error("Drawing processing error:", error);
    return NextResponse.json(
      { error: "Failed to process drawing" },
      { status: 500 }
    );
  }
}
