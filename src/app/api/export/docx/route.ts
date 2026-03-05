import { NextRequest, NextResponse } from "next/server";
import {
  generatePatentDocx,
  type DocxExportOptions,
} from "@/lib/export/docx-generator";
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

  const pageSizeParam = searchParams.get("pageSize");
  const fontSizeParam = searchParams.get("fontSize");
  const paragraphNumbering = searchParams.get("paragraphNumbering");
  const headersFooters = searchParams.get("headersFooters");

  const options: Partial<DocxExportOptions> = {};

  if (pageSizeParam === "a4") {
    options.pageSize = "A4";
  } else {
    options.pageSize = "LETTER";
  }

  if (fontSizeParam) {
    const size = parseInt(fontSizeParam, 10);
    if (size >= 8 && size <= 16) {
      options.fontSize = size;
    }
  }

  if (paragraphNumbering === "false") {
    options.includeParagraphNumbers = false;
  }

  if (headersFooters === "false") {
    options.includeHeadersFooters = false;
  }

  try {
    const buffer = await generatePatentDocx(patent, options);
    const filename = `${patent.title.replace(/[^a-zA-Z0-9]/g, "_")}_Patent_Application.docx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (renderError) {
    console.error("DOCX render error:", renderError);

    try {
      const fallbackPatent = { ...patent, drawings: [] };
      const buffer = await generatePatentDocx(fallbackPatent, options);
      const filename = `${patent.title.replace(/[^a-zA-Z0-9]/g, "_")}_Patent_Application.docx`;

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "X-Drawings-Omitted": "true",
        },
      });
    } catch (fallbackError) {
      console.error("DOCX fallback render error:", fallbackError);
      const message =
        fallbackError instanceof Error
          ? fallbackError.message
          : "Unknown error";
      return NextResponse.json(
        { error: `Failed to render DOCX: ${message}` },
        { status: 500 }
      );
    }
  }
}
