import { NextRequest, NextResponse } from "next/server";
import { generatePatentDocx } from "@/lib/export/docx-generator";
import { getPatent } from "@/lib/actions/patents";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const patentId = searchParams.get("patentId");

  if (!patentId) {
    return NextResponse.json(
      { error: "patentId is required" },
      { status: 400 }
    );
  }

  const patent = await getPatent(patentId);

  if (!patent) {
    return NextResponse.json(
      { error: "Patent not found" },
      { status: 404 }
    );
  }

  const buffer = await generatePatentDocx(patent);

  const filename = `${patent.title.replace(/[^a-zA-Z0-9]/g, "_")}_Patent_Application.docx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
