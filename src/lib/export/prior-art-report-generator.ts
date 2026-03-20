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

interface PriorArtResultData {
  externalPatentNumber: string | null;
  title: string;
  abstract: string | null;
  assignee: string | null;
  filingDate: string | null;
  relevanceScore: number | null;
  riskLevel: string | null;
  aiAnalysis: string | null;
  sourceApi: string;
  externalUrl: string | null;
  addedToIds: boolean | null;
  matchedQuery: string | null;
}

interface PriorArtSearchData {
  query: string;
  apiSources: string[];
  resultCount: number | null;
  cpcFilters: string[] | null;
  searchStrategy: string | null;
  createdAt: Date;
}

export interface PriorArtReportData {
  patentTitle: string;
  patentId: string;
  jurisdiction: string;
  inventionDescription: string | null;
  results: PriorArtResultData[];
  searches: PriorArtSearchData[];
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
          new TextRun({
            text,
            font: FONT,
            size: 18,
          }),
        ],
        spacing: { before: 40, after: 40 },
      }),
    ],
  });
}

function riskColor(risk: string | null): string {
  switch (risk) {
    case "high":
      return "FF4444";
    case "medium":
      return "FF9900";
    case "low":
      return "44AA44";
    default:
      return "999999";
  }
}

export async function generatePriorArtReportDocx(
  data: PriorArtReportData
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Prior Art Analysis Report",
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

  // Executive Summary
  const highRisk = data.results.filter((r) => r.riskLevel === "high").length;
  const medRisk = data.results.filter((r) => r.riskLevel === "medium").length;
  const lowRisk = data.results.filter((r) => r.riskLevel === "low").length;
  const unanalyzed = data.results.filter((r) => !r.riskLevel).length;
  const idsCount = data.results.filter((r) => r.addedToIds).length;

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Executive Summary",
          bold: true,
          font: FONT,
          size: 26,
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 200 },
    })
  );

  const summaryItems = [
    `Total searches conducted: ${data.searches.length}`,
    `Total prior art results found: ${data.results.length}`,
    `Risk distribution: ${highRisk} high, ${medRisk} medium, ${lowRisk} low, ${unanalyzed} unanalyzed`,
    `References marked for IDS: ${idsCount}`,
  ];

  for (const item of summaryItems) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "  \u2022  ", font: FONT, size: 20 }),
          new TextRun({ text: item, font: FONT, size: 20 }),
        ],
        spacing: { before: 60, after: 60 },
      })
    );
  }

  // Search Methodology
  if (data.searches.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Search Methodology",
            bold: true,
            font: FONT,
            size: 26,
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    const searchRows = [
      new TableRow({
        children: [
          headerCell("Date", 2000),
          headerCell("Query", 4000),
          headerCell("Sources", 2000),
          headerCell("Results", 1200),
          headerCell("Strategy", 1200),
        ],
      }),
      ...data.searches.map(
        (s) =>
          new TableRow({
            children: [
              dataCell(
                new Date(s.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }),
                2000
              ),
              dataCell(s.query.length > 60 ? s.query.slice(0, 57) + "..." : s.query, 4000),
              dataCell((s.apiSources || []).join(", "), 2000),
              dataCell(String(s.resultCount ?? 0), 1200),
              dataCell(s.searchStrategy || "standard", 1200),
            ],
          })
      ),
    ];

    children.push(
      new Table({
        rows: searchRows,
        width: { size: 10400, type: WidthType.DXA },
      })
    );
  }

  // Results Table
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Prior Art Results",
          bold: true,
          font: FONT,
          size: 26,
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
    })
  );

  if (data.results.length === 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "No prior art results found.",
            font: FONT,
            size: 20,
            italics: true,
            color: "666666",
          }),
        ],
        spacing: { after: 200 },
      })
    );
  } else {
    const resultRows = [
      new TableRow({
        children: [
          headerCell("Patent Number", 1800),
          headerCell("Title", 3600),
          headerCell("Risk", 1000),
          headerCell("Score", 1000),
          headerCell("Source", 1400),
          headerCell("IDS", 800),
        ],
      }),
      ...data.results.map(
        (r) =>
          new TableRow({
            children: [
              dataCell(r.externalPatentNumber || "N/A", 1800),
              dataCell(
                r.title.length > 50 ? r.title.slice(0, 47) + "..." : r.title,
                3600
              ),
              new TableCell({
                width: { size: 1000, type: WidthType.DXA },
                borders: BORDER,
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: r.riskLevel ? r.riskLevel.toUpperCase() : "N/A",
                        font: FONT,
                        size: 18,
                        bold: true,
                        color: riskColor(r.riskLevel),
                      }),
                    ],
                    spacing: { before: 40, after: 40 },
                  }),
                ],
              }),
              dataCell(
                r.relevanceScore != null
                  ? `${(r.relevanceScore * 100).toFixed(0)}%`
                  : "N/A",
                1000
              ),
              dataCell(
                r.sourceApi === "patentsview" ? "USPTO" : "EPO",
                1400
              ),
              dataCell(r.addedToIds ? "Yes" : "No", 800),
            ],
          })
      ),
    ];

    children.push(
      new Table({
        rows: resultRows,
        width: { size: 10400, type: WidthType.DXA },
      })
    );
  }

  // Detailed Analysis per result
  const analyzedResults = data.results.filter((r) => r.aiAnalysis);
  if (analyzedResults.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Detailed AI Analysis",
            bold: true,
            font: FONT,
            size: 26,
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    for (const r of analyzedResults) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${r.externalPatentNumber || "Unknown"} \u2014 ${r.title}`,
              bold: true,
              font: FONT,
              size: 22,
            }),
          ],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 },
        })
      );

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Risk: `,
              bold: true,
              font: FONT,
              size: 20,
            }),
            new TextRun({
              text: (r.riskLevel || "N/A").toUpperCase(),
              bold: true,
              font: FONT,
              size: 20,
              color: riskColor(r.riskLevel),
            }),
            new TextRun({
              text: `  |  Relevance: ${r.relevanceScore != null ? `${(r.relevanceScore * 100).toFixed(0)}%` : "N/A"}`,
              font: FONT,
              size: 20,
            }),
          ],
          spacing: { after: 100 },
        })
      );

      if (r.aiAnalysis) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: r.aiAnalysis,
                font: FONT,
                size: 20,
              }),
            ],
            spacing: { after: 200 },
            indent: { left: 200 },
          })
        );
      }

      if (r.matchedQuery) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Matched query: `,
                bold: true,
                font: FONT,
                size: 18,
                color: "666666",
              }),
              new TextRun({
                text: r.matchedQuery,
                font: "Courier New",
                size: 16,
                color: "666666",
              }),
            ],
            spacing: { after: 200 },
            indent: { left: 200 },
          })
        );
      }
    }
  }

  // IDS Candidates
  const idsCandidates = data.results.filter((r) => r.addedToIds);
  if (idsCandidates.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "IDS Candidates",
            bold: true,
            font: FONT,
            size: 26,
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    for (let i = 0; i < idsCandidates.length; i++) {
      const r = idsCandidates[i];
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${i + 1}. ${r.externalPatentNumber || "Unknown"} \u2014 ${r.title}`,
              font: FONT,
              size: 20,
            }),
          ],
          spacing: { before: 60, after: 60 },
        })
      );
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
