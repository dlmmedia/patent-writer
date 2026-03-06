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
  ShadingType,
} from "docx";
import type { PatentWithRelations, SectionType } from "@/lib/types";
import { SECTION_LABELS } from "@/lib/types";
import { getINIDFields, getDocumentStats, buildCrossReferenceText, buildGovernmentRightsStatement } from "@/lib/patent/inid-codes";
import type { RelatedApplication, GovernmentContract } from "@/lib/db/schema";

export interface DocxExportOptions {
  pageSize: "LETTER" | "A4";
  fontSize: number;
  includeParagraphNumbers: boolean;
  includeHeadersFooters: boolean;
}

const DEFAULT_OPTIONS: DocxExportOptions = {
  pageSize: "LETTER",
  fontSize: 12,
  includeParagraphNumbers: true,
  includeHeadersFooters: true,
};

const PAGE_SIZES = {
  LETTER: { width: 12240, height: 15840 },
  A4: { width: 11906, height: 16838 },
};

const MARGINS = { top: 1440, right: 1440, bottom: 1440, left: 2160 };
const FONT = "Times New Roman";

const SPEC_SECTIONS: SectionType[] = [
  "cross_reference",
  "field_of_invention",
  "background",
  "summary",
  "brief_description_drawings",
  "detailed_description",
];

function sortByFigureNumber(
  a: { figureNumber: string },
  b: { figureNumber: string }
): number {
  const parse = (s: string) => {
    const m = s.match(/^(\d+)([A-Za-z]?)$/);
    if (!m) return { n: 0, s: s };
    return { n: parseInt(m[1], 10), s: m[2] || "" };
  };
  const pa = parse(a.figureNumber);
  const pb = parse(b.figureNumber);
  return pa.n !== pb.n ? pa.n - pb.n : pa.s.localeCompare(pb.s);
}

function getSectionContent(
  patent: PatentWithRelations,
  type: SectionType
): string {
  return patent.sections.find((s) => s.sectionType === type)?.plainText || "";
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function fmtParaNum(n: number): string {
  return `[${String(n).padStart(4, "0")}]`;
}

function truncateStr(s: string, max = 55): string {
  return s.length <= max ? s : s.slice(0, max - 3) + "...";
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function detectImageType(buf: Buffer): "png" | "jpg" | "gif" | "bmp" {
  if (
    buf.length >= 4 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  )
    return "png";
  if (
    buf.length >= 3 &&
    buf[0] === 0xff &&
    buf[1] === 0xd8 &&
    buf[2] === 0xff
  )
    return "jpg";
  if (
    buf.length >= 3 &&
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46
  )
    return "gif";
  if (buf.length >= 2 && buf[0] === 0x42 && buf[1] === 0x4d) return "bmp";
  return "png";
}

async function fetchImageSafe(url: string): Promise<Buffer | null> {
  try {
    if (url.length > 2_000_000) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// ─── Paragraph Helpers ──────────────────────────────────────────────────────────

function sectionHeading(
  text: string,
  hp: number,
  pageBreak = false
): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 240 },
    pageBreakBefore: pageBreak,
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        font: FONT,
        size: hp + 2,
      }),
    ],
  });
}

function bodyParagraph(text: string, hp: number): Paragraph {
  return new Paragraph({
    spacing: { after: 200, line: 360 },
    alignment: AlignmentType.JUSTIFIED,
    children: [new TextRun({ text, font: FONT, size: hp })],
  });
}

function numberedParagraph(num: number, text: string, hp: number): Paragraph {
  return new Paragraph({
    spacing: { after: 200, line: 360 },
    alignment: AlignmentType.JUSTIFIED,
    indent: { hanging: 720, left: 720 },
    children: [
      new TextRun({
        text: `${fmtParaNum(num)}  `,
        bold: true,
        font: FONT,
        size: hp,
      }),
      new TextRun({ text, font: FONT, size: hp }),
    ],
  });
}

function rule(thick = false): Paragraph {
  return new Paragraph({
    border: {
      bottom: {
        style: BorderStyle.SINGLE,
        size: thick ? 12 : 4,
        color: thick ? "222222" : "AAAAAA",
        space: 1,
      },
    },
    spacing: { before: thick ? 100 : 60, after: thick ? 400 : 200 },
    children: [new TextRun({ text: " " })],
  });
}

function createDocHeader(title: string, hp: number): Header {
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 4,
            color: "CCCCCC",
            space: 2,
          },
        },
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: `${truncateStr(title)} \u2014 Patent Application`,
            font: FONT,
            size: hp - 6,
            italics: true,
            color: "777777",
          }),
        ],
      }),
    ],
  });
}

function createDocFooter(hp: number): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: {
          top: {
            style: BorderStyle.SINGLE,
            size: 4,
            color: "CCCCCC",
            space: 2,
          },
        },
        children: [
          new TextRun({
            text: "Page ",
            font: FONT,
            size: hp - 4,
            color: "777777",
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            font: FONT,
            size: hp - 4,
            color: "777777",
          }),
          new TextRun({
            text: " of ",
            font: FONT,
            size: hp - 4,
            color: "777777",
          }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            font: FONT,
            size: hp - 4,
            color: "777777",
          }),
        ],
      }),
    ],
  });
}

// ─── Main Generator ─────────────────────────────────────────────────────────────

export async function generatePatentDocx(
  patent: PatentWithRelations,
  options?: Partial<DocxExportOptions>
): Promise<Buffer> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const hp = opts.fontSize * 2; // half-points
  const pgSize = PAGE_SIZES[opts.pageSize];
  const inventors = patent.inventors as
    | { name: string; address?: string }[]
    | null;

  // ── INID-Coded Front Page ────────────────────────────────────────────────────

  const titleChildren: Paragraph[] = [];
  const inidFields = getINIDFields(patent as PatentWithRelations);
  const docStats = getDocumentStats(patent as PatentWithRelations);
  const isProvisional = patent.type === "provisional";

  titleChildren.push(new Paragraph({ spacing: { before: 800 } }));

  // Header: Issuing authority and document type
  const authorityField = inidFields.find((f) => f.code === "(19)");
  const docTypeField = inidFields.find((f) => f.code === "(12)");

  titleChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: (authorityField?.value as string) || "United States",
          font: FONT,
          size: hp - 2,
          color: "555555",
        }),
      ],
    })
  );

  titleChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: ((docTypeField?.value as string) || "PATENT APPLICATION PUBLICATION").toUpperCase(),
          bold: true,
          font: FONT,
          size: hp + 4,
          color: "333333",
        }),
      ],
    })
  );

  titleChildren.push(rule(true));

  // INID coded bibliographic data
  for (const field of inidFields) {
    if (field.code === "(19)" || field.code === "(12)" || field.code === "(57)") continue;

    const values = Array.isArray(field.value)
      ? (field.value as string[])
      : [field.value as string];

    if (!values[0]) continue;

    for (let vi = 0; vi < values.length; vi++) {
      titleChildren.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [
            new TextRun({
              text: vi === 0 ? `${field.code} ` : "     ",
              bold: true,
              font: FONT,
              size: hp - 2,
              color: "555555",
            }),
            new TextRun({
              text: vi === 0 ? `${field.label}: ` : "",
              bold: true,
              font: FONT,
              size: hp - 2,
              color: "333333",
            }),
            new TextRun({
              text: values[vi],
              font: FONT,
              size: hp - 2,
              color: "333333",
            }),
          ],
        })
      );
    }
  }

  titleChildren.push(rule(false));

  // Document statistics
  const statsLine = [
    `${docStats.claimCount} Claims`,
    `${docStats.drawingSheetCount} Drawing Sheets`,
  ].join("  |  ");

  titleChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: statsLine,
          font: FONT,
          size: hp - 4,
          color: "666666",
          italics: true,
        }),
      ],
    })
  );

  // Docket number
  titleChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Docket No.: ${patent.docketNumber || "_______________"}`,
          font: FONT,
          size: hp - 4,
          color: "888888",
        }),
      ],
    })
  );

  // Abstract on front page (INID (57))
  const abstractField = inidFields.find((f) => f.code === "(57)");
  if (abstractField?.value) {
    titleChildren.push(rule(false));
    titleChildren.push(
      new Paragraph({
        spacing: { before: 200, after: 100 },
        children: [
          new TextRun({
            text: "(57) ABSTRACT",
            bold: true,
            font: FONT,
            size: hp - 2,
            color: "333333",
          }),
        ],
      })
    );
    const abstractText = (abstractField.value as string).split(/\s+/).slice(0, 150).join(" ");
    titleChildren.push(
      new Paragraph({
        spacing: { after: 200, line: 300 },
        alignment: AlignmentType.JUSTIFIED,
        children: [
          new TextRun({
            text: abstractText,
            font: FONT,
            size: hp - 2,
          }),
        ],
      })
    );
  }

  // ── Specification Body ──────────────────────────────────────────────────────

  const bodyChildren: (Paragraph | Table)[] = [];
  let paraCounter = 1;

  // Provisional header if applicable
  if (isProvisional) {
    bodyChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        children: [
          new TextRun({
            text: "PROVISIONAL APPLICATION FOR PATENT",
            bold: true,
            font: FONT,
            size: hp + 2,
            color: "333333",
          }),
        ],
      })
    );
  }

  bodyChildren.push(sectionHeading("Title of the Invention", hp));
  bodyChildren.push(bodyParagraph(patent.title, hp));

  // Auto-populate Cross-Reference from relatedApplications data
  const relatedApps = (patent.relatedApplications as RelatedApplication[] | null) || [];
  const existingCrossRef = getSectionContent(patent, "cross_reference");
  const autoCrossRef = buildCrossReferenceText(relatedApps);

  for (const type of SPEC_SECTIONS) {
    let content = getSectionContent(patent, type);

    // Use auto-generated cross-reference if section is empty but we have related apps
    if (type === "cross_reference" && !content && autoCrossRef) {
      content = autoCrossRef;
    }

    if (!content) continue;

    bodyChildren.push(sectionHeading(SECTION_LABELS[type], hp));
    const paras = splitIntoParagraphs(content);
    for (const p of paras) {
      bodyChildren.push(
        opts.includeParagraphNumbers
          ? numberedParagraph(paraCounter++, p, hp)
          : bodyParagraph(p, hp)
      );
    }
  }

  // Government rights statement
  const govContract = patent.governmentContract as GovernmentContract | null;
  const govStatement = buildGovernmentRightsStatement(govContract);
  if (govStatement) {
    bodyChildren.push(sectionHeading("Government Rights", hp));
    bodyChildren.push(
      opts.includeParagraphNumbers
        ? numberedParagraph(paraCounter++, govStatement, hp)
        : bodyParagraph(govStatement, hp)
    );
  }

  // ── Claims ──────────────────────────────────────────────────────────────────

  if (patent.claims.length > 0) {
    bodyChildren.push(sectionHeading("Claims", hp, true));
    bodyChildren.push(bodyParagraph("What is claimed is:", hp));

    for (const claim of patent.claims) {
      const dep = claim.isIndependent === false;
      bodyChildren.push(
        new Paragraph({
          spacing: { after: 240, line: 360 },
          alignment: AlignmentType.JUSTIFIED,
          indent: { left: dep ? 720 : 360 },
          children: [
            new TextRun({
              text: `${claim.claimNumber}. `,
              bold: true,
              font: FONT,
              size: hp,
            }),
            new TextRun({
              text: claim.fullText,
              font: FONT,
              size: hp,
            }),
          ],
        })
      );
    }
  }

  // ── Abstract ────────────────────────────────────────────────────────────────

  const abstractText = getSectionContent(patent, "abstract");
  if (abstractText) {
    const truncated = abstractText.split(/\s+/).slice(0, 150).join(" ");
    const wordCount = Math.min(
      abstractText.split(/\s+/).filter(Boolean).length,
      150
    );

    bodyChildren.push(sectionHeading("Abstract", hp, true));
    bodyChildren.push(
      new Paragraph({
        spacing: { after: 200, line: 360 },
        alignment: AlignmentType.JUSTIFIED,
        children: [new TextRun({ text: truncated, font: FONT, size: hp })],
      })
    );
    bodyChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200 },
        children: [
          new TextRun({
            text: `(${wordCount} words)`,
            font: FONT,
            size: hp - 4,
            italics: true,
            color: "666666",
          }),
        ],
      })
    );
  }

  // ── Reference Numerals ──────────────────────────────────────────────────────

  const refNumerals = (patent.referenceNumerals || [])
    .slice()
    .sort((a, b) => a.numeral - b.numeral);

  if (refNumerals.length > 0) {
    bodyChildren.push(sectionHeading("Reference Numerals", hp, true));

    const cellBorders = {
      top: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
    };

    bodyChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              new TableCell({
                width: { size: 20, type: WidthType.PERCENTAGE },
                borders: cellBorders,
                shading: { fill: "E8E8E8", type: ShadingType.CLEAR },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 60, after: 60 },
                    children: [
                      new TextRun({
                        text: "NUMERAL",
                        bold: true,
                        font: FONT,
                        size: hp - 2,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                borders: cellBorders,
                shading: { fill: "E8E8E8", type: ShadingType.CLEAR },
                children: [
                  new Paragraph({
                    spacing: { before: 60, after: 60 },
                    children: [
                      new TextRun({
                        text: "ELEMENT",
                        bold: true,
                        font: FONT,
                        size: hp - 2,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          ...refNumerals.map(
            (rn) =>
              new TableRow({
                children: [
                  new TableCell({
                    borders: cellBorders,
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 40, after: 40 },
                        children: [
                          new TextRun({
                            text: String(rn.numeral),
                            bold: true,
                            font: FONT,
                            size: hp - 2,
                          }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    borders: cellBorders,
                    children: [
                      new Paragraph({
                        spacing: { before: 40, after: 40 },
                        children: [
                          new TextRun({
                            text: rn.elementName,
                            font: FONT,
                            size: hp - 2,
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              })
          ),
        ],
      })
    );
  }

  // ── Drawings ────────────────────────────────────────────────────────────────

  const sortedDrawings = [...patent.drawings].sort(sortByFigureNumber);
  const totalSheets = sortedDrawings.length;

  const drawingImages: {
    drawing: (typeof patent.drawings)[0];
    buffer: Buffer;
    type: "png" | "jpg" | "gif" | "bmp";
  }[] = [];

  for (const drawing of sortedDrawings) {
    const url = drawing.processedUrl || drawing.originalUrl;
    if (url) {
      const buf = await fetchImageSafe(url);
      if (buf) {
        drawingImages.push({
          drawing,
          buffer: buf,
          type: detectImageType(buf),
        });
      }
    }
  }

  if (sortedDrawings.length > 0) {
    let sheetNum = 1;

    for (const drawing of sortedDrawings) {
      const img = drawingImages.find((d) => d.drawing.id === drawing.id);

      if (sheetNum === 1) {
        bodyChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
            pageBreakBefore: true,
            children: [
              new TextRun({
                text: "DRAWINGS",
                bold: true,
                font: FONT,
                size: hp,
              }),
            ],
          })
        );
      } else {
        bodyChildren.push(new Paragraph({ pageBreakBefore: true }));
      }

      bodyChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [
            new TextRun({
              text: `Sheet ${sheetNum} of ${totalSheets}`,
              font: FONT,
              size: hp - 4,
              color: "555555",
            }),
          ],
        })
      );

      if (img) {
        const aspectRatio =
          (drawing.height || 600) / (drawing.width || 800);
        const imgWidth = 480;
        const imgHeight = Math.round(imgWidth * aspectRatio);
        bodyChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [
              new ImageRun({
                data: img.buffer,
                transformation: { width: imgWidth, height: imgHeight },
                type: img.type,
              }),
            ],
          })
        );
      } else {
        bodyChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 1200, after: 240 },
            children: [
              new TextRun({
                text: "[Drawing Placeholder]",
                font: FONT,
                size: hp,
                color: "999999",
              }),
            ],
          })
        );
      }

      bodyChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: `FIG. ${drawing.figureNumber}`,
              bold: true,
              font: FONT,
              size: hp,
            }),
          ],
        })
      );

      if (drawing.figureLabel) {
        bodyChildren.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: drawing.figureLabel,
                font: FONT,
                size: hp - 4,
                italics: true,
                color: "555555",
              }),
            ],
          })
        );
      }

      sheetNum++;
    }
  }

  // ── Assemble Document ───────────────────────────────────────────────────────

  const pageProps = {
    size: pgSize,
    margin: MARGINS,
    pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
  };

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: hp },
          paragraph: { spacing: { line: 360 } },
        },
        heading1: {
          run: { font: FONT, size: hp + 2, bold: true },
          paragraph: { spacing: { before: 480, after: 240 } },
        },
        heading2: {
          run: { font: FONT, size: hp, bold: true },
          paragraph: { spacing: { before: 360, after: 200 } },
        },
      },
    },
    sections: [
      {
        properties: { page: pageProps },
        headers: {
          default: new Header({
            children: [new Paragraph({ children: [] })],
          }),
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({ children: [] })],
          }),
        },
        children: titleChildren,
      },
      {
        properties: {
          page: { size: pgSize, margin: MARGINS },
        },
        ...(opts.includeHeadersFooters
          ? {
              headers: { default: createDocHeader(patent.title, hp) },
              footers: { default: createDocFooter(hp) },
            }
          : {}),
        children: bodyChildren,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
