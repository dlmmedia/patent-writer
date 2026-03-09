import { NextRequest, NextResponse } from "next/server";
import { generateUsptoPdf } from "@/lib/export/uspto-pdf-generator";
import type { UsptoExportOptions } from "@/lib/export/uspto-html-template";
import { getPatent } from "@/lib/actions/patents";

function sanitizeText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\uFFFD/g, "")
    .replace(/[\uD800-\uDFFF]/g, "");
}

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
  const patentNumber = searchParams.get("patentNumber");
  const patentDate = searchParams.get("patentDate");

  const options: Partial<UsptoExportOptions> = {};

  if (pageSizeParam === "a4") {
    options.pageSize = "A4";
  } else {
    options.pageSize = "LETTER";
  }

  if (fontSizeParam) {
    const size = parseInt(fontSizeParam, 10);
    if (size >= 7 && size <= 12) {
      options.fontSize = size;
    }
  }

  if (paragraphNumbering === "false") {
    options.includeParagraphNumbers = false;
  }

  if (patentNumber) {
    options.patentNumber = patentNumber;
  }

  if (patentDate) {
    options.patentDate = patentDate;
  }

  const safePatent = {
    ...patent,
    title: sanitizeText(patent.title),
    assignee: patent.assignee ? sanitizeText(patent.assignee) : patent.assignee,
    technologyArea: patent.technologyArea
      ? sanitizeText(patent.technologyArea)
      : patent.technologyArea,
    sections: patent.sections.map((s) => ({
      ...s,
      plainText: sanitizeText(s.plainText),
      title: sanitizeText(s.title),
    })),
    claims: patent.claims.map((c) => ({
      ...c,
      fullText: sanitizeText(c.fullText),
      preamble: c.preamble ? sanitizeText(c.preamble) : c.preamble,
      body: c.body ? sanitizeText(c.body) : c.body,
    })),
    drawings: patent.drawings.map((d) => {
      const url = d.processedUrl || d.originalUrl;
      if (url && url.length > 2_000_000) {
        return { ...d, originalUrl: null, processedUrl: null };
      }
      return {
        ...d,
        figureLabel: sanitizeText(d.figureLabel),
      };
    }),
  };

  try {
    const buffer = await generateUsptoPdf(safePatent, options);

    const filename = `${patent.title.replace(/[^a-zA-Z0-9]/g, "_")}_USPTO_Patent.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("USPTO PDF render error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to render USPTO PDF: ${message}` },
      { status: 500 }
    );
  }
}
