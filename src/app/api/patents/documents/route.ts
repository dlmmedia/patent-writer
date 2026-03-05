import { NextRequest } from "next/server";
import { PDFParse } from "pdf-parse";
import { db } from "@/lib/db";
import { patentDocuments } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    return result.text || "";
  } catch (err) {
    console.error("PDF parsing error:", err);
    throw new Error("Failed to parse PDF file");
  }
}

async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  } catch (err) {
    console.error("DOCX parsing error:", err);
    throw new Error("Failed to parse DOCX file");
  }
}

async function extractText(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  const ext = fileName.split(".").pop()?.toLowerCase();

  if (mimeType === "application/pdf" || ext === "pdf") {
    return extractTextFromPDF(buffer);
  }

  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  ) {
    return extractTextFromDOCX(buffer);
  }

  if (
    mimeType.startsWith("text/") ||
    ["txt", "md", "csv", "json", "xml", "html", "rtf"].includes(ext || "")
  ) {
    return buffer.toString("utf-8");
  }

  throw new Error(
    `Unsupported file type: ${ext || mimeType}. Supported: PDF, DOCX, TXT, MD`
  );
}

const MAX_TEXT_LENGTH = 100_000;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const patentId = formData.get("patentId") as string | null;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }
    if (!patentId) {
      return Response.json(
        { error: "patentId is required" },
        { status: 400 }
      );
    }

    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      return Response.json(
        { error: "File too large. Maximum size is 20MB." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let extractedText = await extractText(buffer, file.name, file.type);

    if (extractedText.length > MAX_TEXT_LENGTH) {
      extractedText = extractedText.slice(0, MAX_TEXT_LENGTH);
    }

    const [doc] = await db
      .insert(patentDocuments)
      .values({
        patentId,
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
        extractedText,
      })
      .returning();

    return Response.json({
      id: doc.id,
      fileName: doc.fileName,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      textLength: extractedText.length,
      createdAt: doc.createdAt,
    });
  } catch (error) {
    console.error("Document upload error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: `Failed to upload document: ${message}` },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const patentId = req.nextUrl.searchParams.get("patentId");
  if (!patentId) {
    return Response.json(
      { error: "patentId is required" },
      { status: 400 }
    );
  }

  const docs = await db.query.patentDocuments.findMany({
    where: eq(patentDocuments.patentId, patentId),
    orderBy: [desc(patentDocuments.createdAt)],
    columns: {
      id: true,
      fileName: true,
      fileType: true,
      fileSize: true,
      createdAt: true,
    },
  });

  return Response.json(docs);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  await db.delete(patentDocuments).where(eq(patentDocuments.id, id));
  return Response.json({ success: true });
}
