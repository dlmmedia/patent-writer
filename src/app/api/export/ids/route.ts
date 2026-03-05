import { NextRequest, NextResponse } from "next/server";
import { generateIDS } from "@/lib/export/ids-generator";
import { getPatent, getPriorArtResults } from "@/lib/actions/patents";
import type { PatentWithRelations } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const patentId = searchParams.get("patentId");

  if (!patentId) {
    return NextResponse.json(
      { error: "patentId is required" },
      { status: 400 }
    );
  }

  try {
    const patent = await getPatent(patentId);

    if (!patent) {
      return NextResponse.json(
        { error: "Patent not found" },
        { status: 404 }
      );
    }

    const priorArtResults = await getPriorArtResults(patentId);
    const buffer = await generateIDS(patent as PatentWithRelations, priorArtResults);

    const filename = `${patent.title.replace(/[^a-zA-Z0-9]/g, "_")}_IDS.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("IDS generation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to generate IDS: ${message}` },
      { status: 500 }
    );
  }
}
