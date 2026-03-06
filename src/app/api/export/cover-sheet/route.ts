import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { patents, patentSections, patentClaims, patentDrawings, patentDocuments, referenceNumerals } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { generateCoverSheet } from "@/lib/export/cover-sheet-generator";

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

    const buffer = await generateCoverSheet(patent as any);
    const slug = patent.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="PTO-SB-16_${slug}.docx"`,
      },
    });
  } catch (error) {
    console.error("Cover sheet export error:", error);
    return Response.json(
      { error: "Failed to generate cover sheet" },
      { status: 500 }
    );
  }
}
