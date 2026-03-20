import { NextResponse } from "next/server";
import { getPatent, getLatestSearchMatrix } from "@/lib/actions/patents";
import {
  generateSearchMatrixDocx,
  type SearchMatrixExportData,
} from "@/lib/export/search-matrix-generator";

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
    if (!matrix) {
      return NextResponse.json(
        { error: "No search matrix found. Generate one first from the Prior Art page." },
        { status: 404 }
      );
    }

    const exportData: SearchMatrixExportData = {
      patentTitle: patent.title,
      patentId: patent.id,
      jurisdiction: patent.jurisdiction,
      cpcEntries: (matrix.cpcEntries as SearchMatrixExportData["cpcEntries"]) || [],
      combinedQueries: (matrix.combinedQueries as SearchMatrixExportData["combinedQueries"]) || [],
      searchWorkflow: (matrix.searchWorkflow as SearchMatrixExportData["searchWorkflow"]) || { passes: [] },
      strongestTerms: matrix.strongestTerms as SearchMatrixExportData["strongestTerms"],
      priorArtRiskAreas: (matrix.priorArtRiskAreas as SearchMatrixExportData["priorArtRiskAreas"]) || [],
      generatedDate: new Date(matrix.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    };

    const buffer = await generateSearchMatrixDocx(exportData);

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
        "Content-Disposition": `attachment; filename="${sanitizedTitle}_CPC_Search_Matrix.docx"`,
      },
    });
  } catch (err) {
    console.error("Search matrix export error:", err);
    return NextResponse.json(
      { error: "Failed to generate search matrix document" },
      { status: 500 }
    );
  }
}
