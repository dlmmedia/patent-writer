import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import {
  PatentPDFDocument,
  type PdfExportOptions,
} from "@/lib/export/pdf-generator";
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
  const headersFooters = searchParams.get("headersFooters");

  const options: Partial<PdfExportOptions> = {};

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = React.createElement(PatentPDFDocument, {
      patent: safePatent,
      options,
    } as any);
    const buffer = await renderToBuffer(element as any);

    const filename = `${patent.title.replace(/[^a-zA-Z0-9]/g, "_")}_Patent_Application.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (renderError) {
    console.error("PDF render error:", renderError);

    try {
      const fallbackPatent = { ...safePatent, drawings: [] };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const element = React.createElement(PatentPDFDocument, {
        patent: fallbackPatent,
        options,
      } as any);
      const buffer = await renderToBuffer(element as any);

      const filename = `${patent.title.replace(/[^a-zA-Z0-9]/g, "_")}_Patent_Application.pdf`;

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "X-Drawings-Omitted": "true",
        },
      });
    } catch (fallbackError) {
      console.error("PDF fallback render error:", fallbackError);
      const message =
        fallbackError instanceof Error
          ? fallbackError.message
          : "Unknown error";
      return NextResponse.json(
        { error: `Failed to render PDF: ${message}` },
        { status: 500 }
      );
    }
  }
}
