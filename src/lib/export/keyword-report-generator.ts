import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
} from "docx";

const FONT = "Times New Roman";
const MARGINS = { top: 1440, right: 1440, bottom: 1440, left: 1440 };

interface KeywordGroupData {
  category: string;
  description: string;
  keywords: string[];
}

interface SuggestedQueryData {
  description: string;
  queryString: string;
  targetFields: string[];
}

interface SearchPassData {
  name: string;
  description: string;
  queries: string[];
}

interface SubstituteTermData {
  original: string;
  substitutes: string[];
}

interface CpcCodeData {
  code: string;
  description?: string;
}

export interface KeywordReportData {
  patentTitle: string;
  patentId: string;
  jurisdiction: string;
  inventionDescription: string | null;
  keywordGroups: KeywordGroupData[];
  suggestedQueries: SuggestedQueryData[];
  searchStrategy: { passes: SearchPassData[] };
  substituteTerms: SubstituteTermData[];
  cpcCodes: CpcCodeData[];
  generatedDate: string;
}

const BORDER = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
} as const;

function headerCell(text: string, width?: number): TableCell {
  return new TableCell({
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    shading: { type: ShadingType.SOLID, color: "2B579A", fill: "2B579A" },
    borders: BORDER,
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: true,
            font: FONT,
            size: 18,
            color: "FFFFFF",
          }),
        ],
        spacing: { before: 60, after: 60 },
      }),
    ],
  });
}

function dataCell(text: string, width?: number): TableCell {
  return new TableCell({
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    borders: BORDER,
    children: [
      new Paragraph({
        children: [
          new TextRun({ text, font: FONT, size: 18 }),
        ],
        spacing: { before: 40, after: 40 },
      }),
    ],
  });
}

export async function generateKeywordReportDocx(
  data: KeywordReportData
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Keyword Analysis Report",
          bold: true,
          font: FONT,
          size: 32,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: data.patentTitle,
          italics: true,
          font: FONT,
          size: 24,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Prior art search keyword strategy and analysis`,
          font: FONT,
          size: 20,
          color: "666666",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated: ${data.generatedDate} | Jurisdiction: ${data.jurisdiction}`,
          font: FONT,
          size: 18,
          color: "999999",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // Invention Summary
  if (data.inventionDescription) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Invention Summary",
            bold: true,
            font: FONT,
            size: 26,
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 200 },
      })
    );

    const descTruncated =
      data.inventionDescription.length > 1000
        ? data.inventionDescription.slice(0, 997) + "..."
        : data.inventionDescription;

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: descTruncated,
            font: FONT,
            size: 20,
          }),
        ],
        spacing: { after: 200 },
      })
    );
  }

  // CPC Code Analysis
  if (data.cpcCodes.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "CPC Code Analysis",
            bold: true,
            font: FONT,
            size: 26,
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    const cpcRows = [
      new TableRow({
        children: [
          headerCell("CPC Code", 2400),
          headerCell("Description", 8000),
        ],
      }),
      ...data.cpcCodes.map(
        (c) =>
          new TableRow({
            children: [
              dataCell(c.code, 2400),
              dataCell(c.description || "—", 8000),
            ],
          })
      ),
    ];

    children.push(
      new Table({
        rows: cpcRows,
        width: { size: 10400, type: WidthType.DXA },
      })
    );
  }

  // Keyword Groups
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Keyword Groups",
          bold: true,
          font: FONT,
          size: 26,
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    })
  );

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${data.keywordGroups.length} thematic keyword groups generated for comprehensive prior art coverage.`,
          font: FONT,
          size: 20,
          color: "666666",
        }),
      ],
      spacing: { after: 200 },
    })
  );

  for (const group of data.keywordGroups) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: group.category,
            bold: true,
            font: FONT,
            size: 22,
          }),
        ],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 80 },
      })
    );

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: group.description,
            font: FONT,
            size: 20,
            italics: true,
            color: "666666",
          }),
        ],
        spacing: { after: 80 },
        indent: { left: 200 },
      })
    );

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: group.keywords.join("  \u2022  "),
            font: FONT,
            size: 20,
          }),
        ],
        spacing: { after: 160 },
        indent: { left: 200 },
      })
    );
  }

  // Suggested Search Strings
  if (data.suggestedQueries.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Suggested Search Strings",
            bold: true,
            font: FONT,
            size: 26,
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    for (let i = 0; i < data.suggestedQueries.length; i++) {
      const q = data.suggestedQueries[i];
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${i + 1}. ${q.description}`,
              bold: true,
              font: FONT,
              size: 20,
            }),
          ],
          spacing: { before: 120, after: 40 },
        })
      );
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: q.queryString,
              font: "Courier New",
              size: 18,
              color: "333333",
            }),
          ],
          spacing: { after: 40 },
          indent: { left: 400 },
        })
      );
      if (q.targetFields.length > 0) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Target fields: ${q.targetFields.join(", ")}`,
                font: FONT,
                size: 16,
                color: "999999",
                italics: true,
              }),
            ],
            spacing: { after: 120 },
            indent: { left: 400 },
          })
        );
      }
    }
  }

  // Substitute Terms
  if (data.substituteTerms.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Alternative / Substitute Terms",
            bold: true,
            font: FONT,
            size: 26,
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Prior art may use different vocabulary. Search with these substitutes to avoid missing relevant references.",
            font: FONT,
            size: 20,
            color: "666666",
          }),
        ],
        spacing: { after: 200 },
      })
    );

    const subRows = [
      new TableRow({
        children: [
          headerCell("Invention Term", 3200),
          headerCell("Substitute Terms", 7200),
        ],
      }),
      ...data.substituteTerms.map(
        (s) =>
          new TableRow({
            children: [
              dataCell(s.original, 3200),
              dataCell(s.substitutes.join(", "), 7200),
            ],
          })
      ),
    ];

    children.push(
      new Table({
        rows: subRows,
        width: { size: 10400, type: WidthType.DXA },
      })
    );
  }

  // Search Strategy
  if (data.searchStrategy?.passes?.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Recommended Search Strategy",
            bold: true,
            font: FONT,
            size: 26,
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    for (const pass of data.searchStrategy.passes) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: pass.name,
              bold: true,
              font: FONT,
              size: 22,
            }),
          ],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 80 },
        })
      );

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: pass.description,
              font: FONT,
              size: 20,
            }),
          ],
          spacing: { after: 80 },
          indent: { left: 200 },
        })
      );

      for (const q of pass.queries) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `\u2022  ${q}`,
                font: "Courier New",
                size: 16,
              }),
            ],
            spacing: { before: 40, after: 40 },
            indent: { left: 400 },
          })
        );
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: MARGINS,
          },
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
