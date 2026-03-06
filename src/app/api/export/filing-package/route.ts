import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { patents, patentSections, patentClaims, patentDrawings, patentDocuments, referenceNumerals, priorArtResults } from "@/lib/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { generatePatentDocx } from "@/lib/export/docx-generator";
import { generateCoverSheet } from "@/lib/export/cover-sheet-generator";
import { generateIDS } from "@/lib/export/ids-generator";
import JSZip from "jszip";

export async function GET(req: NextRequest) {
  try {
    const patentId = req.nextUrl.searchParams.get("patentId");
    if (!patentId) {
      return Response.json({ error: "patentId is required" }, { status: 400 });
    }

    const patent = await db.query.patents.findFirst({
      where: eq(patents.id, patentId),
      with: {
        sections: { orderBy: [asc(patentSections.orderIndex)] },
        claims: { orderBy: [asc(patentClaims.claimNumber)] },
        drawings: { orderBy: [asc(patentDrawings.figureNumber)] },
        documents: true,
        referenceNumerals: { orderBy: [asc(referenceNumerals.numeral)] },
      },
    });

    if (!patent) {
      return Response.json({ error: "Patent not found" }, { status: 404 });
    }

    const priorArt = await db.query.priorArtResults.findMany({
      where: eq(priorArtResults.patentId, patentId),
      orderBy: [desc(priorArtResults.relevanceScore)],
    });

    const zip = new JSZip();

    // 1. Specification DOCX
    const specDocx = await generatePatentDocx(patent as any);
    zip.file("Specification.docx", specDocx);

    // 2. Cover Sheet (PTO/SB/16)
    try {
      const coverSheet = await generateCoverSheet(patent as any);
      zip.file("PTO-SB-16_Cover_Sheet.docx", coverSheet);
    } catch {
      // non-critical
    }

    // 3. IDS (if prior art exists)
    const idsResults = priorArt.filter((r) => r.addedToIds);
    if (idsResults.length > 0) {
      try {
        const ids = await generateIDS(patent as any, idsResults);
        zip.file("Information_Disclosure_Statement.docx", ids);
      } catch {
        // non-critical
      }
    }

    // 4. Fee Worksheet
    const entitySize = patent.entitySize || "small";
    const fees: Record<string, number> = {
      micro: 65,
      small: 160,
      large: 320,
    };
    const feeSheet = [
      "USPTO Filing Fee Worksheet",
      "================================",
      "",
      `Patent Title: ${patent.title}`,
      `Application Type: ${patent.type}`,
      `Entity Size: ${entitySize}`,
      `Docket Number: ${patent.docketNumber || "N/A"}`,
      "",
      "Fees:",
      `  Filing Fee: $${fees[entitySize] || 160}`,
      "",
      `Total: $${fees[entitySize] || 160}`,
      "",
      "Note: Additional fees may apply if specification and drawings exceed 100 sheets.",
      "Check current fees at: https://www.uspto.gov/learning-and-resources/fees-and-payment/uspto-fee-schedule",
    ].join("\n");
    zip.file("Fee_Worksheet.txt", feeSheet);

    const buffer = await zip.generateAsync({ type: "nodebuffer" });

    const slug = patent.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="filing-package_${slug}.zip"`,
      },
    });
  } catch (error) {
    console.error("Filing package error:", error);
    return Response.json(
      { error: "Failed to generate filing package" },
      { status: 500 }
    );
  }
}
