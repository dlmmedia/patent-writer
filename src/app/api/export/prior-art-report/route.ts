import { NextResponse } from "next/server";
import { getPatent, getPriorArtResults, getPriorArtSearches } from "@/lib/actions/patents";
import {
  generatePriorArtReportDocx,
  type PriorArtReportData,
} from "@/lib/export/prior-art-report-generator";

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

    const results = await getPriorArtResults(patentId);
    const searches = await getPriorArtSearches(patentId);

    const exportData: PriorArtReportData = {
      patentTitle: patent.title,
      patentId: patent.id,
      jurisdiction: patent.jurisdiction,
      inventionDescription: patent.inventionDescription,
      results: results.map((r) => ({
        externalPatentNumber: r.externalPatentNumber,
        title: r.title,
        abstract: r.abstract,
        assignee: r.assignee,
        filingDate: r.filingDate,
        relevanceScore: r.relevanceScore,
        riskLevel: r.riskLevel,
        aiAnalysis: r.aiAnalysis,
        sourceApi: r.sourceApi,
        externalUrl: r.externalUrl,
        addedToIds: r.addedToIds,
        matchedQuery: r.matchedQuery,
      })),
      searches: searches.map((s) => ({
        query: s.query,
        apiSources: (s.apiSources as string[]) || [],
        resultCount: s.resultCount,
        cpcFilters: s.cpcFilters as string[] | null,
        searchStrategy: s.searchStrategy,
        createdAt: s.createdAt,
      })),
      generatedDate: new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    };

    const buffer = await generatePriorArtReportDocx(exportData);

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
        "Content-Disposition": `attachment; filename="${sanitizedTitle}_Prior_Art_Report.docx"`,
      },
    });
  } catch (err) {
    console.error("Prior art report export error:", err);
    return NextResponse.json(
      { error: "Failed to generate prior art report" },
      { status: 500 }
    );
  }
}
