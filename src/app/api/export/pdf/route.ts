import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { PatentPDFDocument } from "@/lib/export/pdf-generator";
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(PatentPDFDocument, { patent } as any);
  const buffer = await renderToBuffer(element as any);

  const filename = `${patent.title.replace(/[^a-zA-Z0-9]/g, "_")}_Patent_Application.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
