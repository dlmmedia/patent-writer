import { NextResponse } from "next/server";
import { getPatent, getLatestSearchMatrix } from "@/lib/actions/patents";
import {
  generateKeywordReportDocx,
  type KeywordReportData,
} from "@/lib/export/keyword-report-generator";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
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

    const matrix = await getLatestSearchMatrix(patentId);

    const keywordGroups = matrix?.keywordGroups as KeywordReportData["keywordGroups"] || [];

    if (keywordGroups.length === 0) {
      return NextResponse.json(
        { error: "No keyword data found. Generate keywords from the Prior Art page first." },
        { status: 404 }
      );
    }

    const cpcCodes = ((patent.cpcCodes as string[]) || []).map((code) => ({
      code,
      description: matrix?.cpcEntries
        ? (matrix.cpcEntries as { cpcCode: string; plainEnglishFocus: string }[])
            .find((e) => e.cpcCode === code)?.plainEnglishFocus
        : undefined,
    }));

    const exportData: KeywordReportData = {
      patentTitle: patent.title,
      patentId: patent.id,
      jurisdiction: patent.jurisdiction,
      inventionDescription: patent.inventionDescription,
      keywordGroups,
      suggestedQueries: [],
      searchStrategy: { passes: [] },
      substituteTerms: [],
      cpcCodes,
      generatedDate: new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    };

    const buffer = await generateKeywordReportDocx(exportData);

    const sanitizedTitle = patent.title
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 40);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${sanitizedTitle}_Keyword_Analysis.docx"`,
      },
    });
  } catch (err) {
    console.error("Keyword report export error:", err);
    return NextResponse.json(
      { error: "Failed to generate keyword report" },
      { status: 500 }
    );
  }
}
