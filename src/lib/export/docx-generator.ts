import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";
import type { PatentWithRelations, SectionType } from "@/lib/types";
import { SECTION_LABELS } from "@/lib/types";

function getSectionContent(
  patent: PatentWithRelations,
  sectionType: SectionType
): string {
  const section = patent.sections.find((s) => s.sectionType === sectionType);
  return section?.plainText || "";
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function formatParagraphNumber(n: number): string {
  return `[${String(n).padStart(4, "0")}]`;
}

function createSectionHeading(title: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 240 },
    children: [
      new TextRun({
        text: title.toUpperCase(),
        bold: true,
        font: "Times New Roman",
        size: 24,
      }),
    ],
  });
}

function createParagraph(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 200, line: 360 },
    alignment: AlignmentType.JUSTIFIED,
    children: [
      new TextRun({
        text,
        font: "Times New Roman",
        size: 24,
      }),
    ],
  });
}

function createNumberedParagraph(number: number, text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 200, line: 360 },
    alignment: AlignmentType.JUSTIFIED,
    indent: { hanging: 720, left: 720 },
    children: [
      new TextRun({
        text: `${formatParagraphNumber(number)}  `,
        bold: true,
        font: "Times New Roman",
        size: 24,
      }),
      new TextRun({
        text,
        font: "Times New Roman",
        size: 24,
      }),
    ],
  });
}

function createSectionParagraphs(
  content: string,
  numbered: boolean,
  startNumber: number
): { paragraphs: Paragraph[]; count: number } {
  const parts = splitIntoParagraphs(content);
  const paragraphs = parts.map((p, i) =>
    numbered
      ? createNumberedParagraph(startNumber + i, p)
      : createParagraph(p)
  );
  return { paragraphs, count: parts.length };
}

async function fetchImageAsBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

export async function generatePatentDocx(
  patent: PatentWithRelations
): Promise<Buffer> {
  const inventors = patent.inventors as { name: string; address?: string }[] | null;
  const children: Paragraph[] = [];
  let paragraphCounter = 1;

  // Title page content
  children.push(
    new Paragraph({ spacing: { before: 2400 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: "PATENT APPLICATION",
          font: "Times New Roman",
          size: 22,
          color: "666666",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 },
      children: [
        new TextRun({
          text: patent.title.toUpperCase(),
          bold: true,
          font: "Times New Roman",
          size: 32,
        }),
      ],
    })
  );

  if (inventors && inventors.length > 0) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: inventors.length === 1 ? "Inventor:" : "Inventors:",
            bold: true,
            font: "Times New Roman",
            size: 24,
          }),
        ],
      })
    );
    for (const inv of inventors) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: inv.name + (inv.address ? `, ${inv.address}` : ""),
              font: "Times New Roman",
              size: 24,
            }),
          ],
        })
      );
    }
  }

  if (patent.assignee) {
    children.push(
      new Paragraph({ spacing: { before: 240 } }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: "Assignee:",
            bold: true,
            font: "Times New Roman",
            size: 24,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: patent.assignee,
            font: "Times New Roman",
            size: 24,
          }),
        ],
      })
    );
  }

  children.push(new Paragraph({ pageBreakBefore: true }));

  // Title section
  children.push(createSectionHeading("Title of the Invention"));
  children.push(createParagraph(patent.title));

  // Numbered sections in specification order
  const numberedSections: { type: SectionType; label: string }[] = [
    { type: "cross_reference", label: SECTION_LABELS.cross_reference },
    { type: "field_of_invention", label: SECTION_LABELS.field_of_invention },
    { type: "background", label: SECTION_LABELS.background },
    { type: "summary", label: SECTION_LABELS.summary },
    { type: "brief_description_drawings", label: SECTION_LABELS.brief_description_drawings },
    { type: "detailed_description", label: SECTION_LABELS.detailed_description },
  ];

  for (const sec of numberedSections) {
    const content = getSectionContent(patent, sec.type);
    if (!content) continue;

    children.push(createSectionHeading(sec.label));
    const { paragraphs, count } = createSectionParagraphs(
      content,
      true,
      paragraphCounter
    );
    children.push(...paragraphs);
    paragraphCounter += count;
  }

  // Claims on a new page
  if (patent.claims.length > 0) {
    children.push(
      new Paragraph({ pageBreakBefore: true }),
      createSectionHeading("Claims")
    );
    children.push(
      createParagraph("What is claimed is:")
    );

    for (const claim of patent.claims) {
      children.push(
        new Paragraph({
          spacing: { after: 240, line: 360 },
          alignment: AlignmentType.JUSTIFIED,
          indent: { left: 360 },
          children: [
            new TextRun({
              text: `${claim.claimNumber}. `,
              bold: true,
              font: "Times New Roman",
              size: 24,
            }),
            new TextRun({
              text: claim.fullText,
              font: "Times New Roman",
              size: 24,
            }),
          ],
        })
      );
    }
  }

  // Abstract on a new page
  const abstractText = getSectionContent(patent, "abstract");
  if (abstractText) {
    const truncated = abstractText.split(/\s+/).slice(0, 150).join(" ");
    children.push(
      new Paragraph({ pageBreakBefore: true }),
      createSectionHeading("Abstract")
    );
    children.push(
      new Paragraph({
        spacing: { after: 200, line: 360 },
        alignment: AlignmentType.JUSTIFIED,
        children: [
          new TextRun({
            text: truncated,
            font: "Times New Roman",
            size: 24,
          }),
        ],
      })
    );
  }

  // Drawings
  const drawingImages: { drawing: typeof patent.drawings[0]; buffer: Buffer }[] = [];
  for (const drawing of patent.drawings) {
    const url = drawing.processedUrl || drawing.originalUrl;
    if (url) {
      const buf = await fetchImageAsBuffer(url);
      if (buf) {
        drawingImages.push({ drawing, buffer: buf });
      }
    }
  }

  for (const { drawing, buffer } of drawingImages) {
    children.push(
      new Paragraph({ pageBreakBefore: true }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [
          new ImageRun({
            data: buffer,
            transformation: {
              width: 500,
              height: Math.round(
                500 * ((drawing.height || 600) / (drawing.width || 800))
              ),
            },
            type: "png",
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: `FIG. ${drawing.figureNumber}`,
            bold: true,
            font: "Times New Roman",
            size: 24,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: drawing.figureLabel,
            font: "Times New Roman",
            size: 20,
            italics: true,
          }),
        ],
      })
    );
  }

  // Add drawing labels without images for those that failed to fetch
  for (const drawing of patent.drawings) {
    const hasImage = drawingImages.some((d) => d.drawing.id === drawing.id);
    if (hasImage) continue;

    children.push(
      new Paragraph({ pageBreakBefore: true }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 2400, after: 240 },
        children: [
          new TextRun({
            text: "[Drawing Placeholder]",
            font: "Times New Roman",
            size: 24,
            color: "999999",
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [
          new TextRun({
            text: `FIG. ${drawing.figureNumber}`,
            bold: true,
            font: "Times New Roman",
            size: 24,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: drawing.figureLabel,
            font: "Times New Roman",
            size: 20,
            italics: true,
          }),
        ],
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 12240,
              height: 15840,
            },
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 2160,
            },
            pageNumbers: {
              start: 1,
              formatType: NumberFormat.DECIMAL,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: "Patent Application",
                    font: "Times New Roman",
                    size: 18,
                    color: "999999",
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: "Times New Roman",
                    size: 20,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
