import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, annotations } = await req.json();

    if (!imageBase64) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    const inputBuffer = Buffer.from(imageBase64, "base64");
    const metadata = await sharp(inputBuffer).metadata();
    const width = metadata.width || 1024;
    const height = metadata.height || 1024;

    const svgOverlays: string[] = [];

    if (annotations?.numerals) {
      for (const numeral of annotations.numerals) {
        const x = Math.round(numeral.x * width);
        const y = Math.round(numeral.y * height);

        svgOverlays.push(`
          <rect x="${x - 18}" y="${y - 14}" width="36" height="20" rx="3" fill="white" stroke="black" stroke-width="1.5"/>
          <text x="${x}" y="${y + 2}" text-anchor="middle" font-family="Helvetica" font-size="12" font-weight="bold" fill="black">${numeral.numeral}</text>
        `);
      }
    }

    if (annotations?.arrows) {
      for (const arrow of annotations.arrows) {
        const x1 = Math.round(arrow.fromX * width);
        const y1 = Math.round(arrow.fromY * height);
        const x2 = Math.round(arrow.toX * width);
        const y2 = Math.round(arrow.toY * height);

        svgOverlays.push(`
          <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="black" stroke-width="1.5"/>
        `);
      }
    }

    if (svgOverlays.length === 0) {
      return NextResponse.json({
        annotated: imageBase64,
        width,
        height,
      });
    }

    const svgOverlay = Buffer.from(`
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        ${svgOverlays.join("\n")}
      </svg>
    `);

    const annotatedBuffer = await sharp(inputBuffer)
      .composite([{ input: svgOverlay, top: 0, left: 0 }])
      .png()
      .toBuffer();

    return NextResponse.json({
      annotated: annotatedBuffer.toString("base64"),
      width,
      height,
    });
  } catch (error) {
    console.error("Annotation error:", error);
    return NextResponse.json(
      { error: "Failed to annotate drawing" },
      { status: 500 }
    );
  }
}
