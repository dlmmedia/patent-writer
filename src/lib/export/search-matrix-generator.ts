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

interface CpcEntry {
  cpcCode: string;
  plainEnglishFocus: string;
  keywords: string[];
  starterQueries: string[];
  relevanceRanking: number;
  reclassificationNotes?: string;
}

interface CombinedQuery {
  description: string;
  queryString: string;
}

interface WorkflowPass {
  step: number;
  name: string;
  description: string;
  whatToLookFor: string;
  queries: string[];
}

interface RiskArea {
  area: string;
  description: string;
  likelyCpcCodes: string[];
}

export interface SearchMatrixExportData {
  patentTitle: string;
  patentId: string;
  jurisdiction: string;
  cpcEntries: CpcEntry[];
  combinedQueries: CombinedQuery[];
  searchWorkflow: { passes: WorkflowPass[] };
  strongestTerms?: {
    structureTerms: string[];
    conversionTerms: string[];
    cleanupTerms: string[];
    inputFormatTerms: string[];
  };
  priorArtRiskAreas: RiskArea[];
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

function dataCell(text: string, width?: number, mono = false): TableCell {
  return new TableCell({
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    borders: BORDER,
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            font: mono ? "Courier New" : FONT,
            size: 18,
          }),
        ],
        spacing: { before: 40, after: 40 },
      }),
    ],
  });
}

export async function generateSearchMatrixDocx(
  data: SearchMatrixExportData
): Promise<Buffer> {
  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `CPC Search Matrix`,
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
          text: `USPTO Patent Public Search worksheet for prior art review`,
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

  // Core CPC Search Matrix heading
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "Core CPC Search Matrix",
          bold: true,
          font: FONT,
          size: 26,
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 200 },
    })
  );

  // CPC Matrix Table
  const matrixRows = [
    new TableRow({
      children: [
        headerCell("CPC Code", 1600),
        headerCell("Plain-English Focus", 2800),
        headerCell("Best Keywords", 2800),
        headerCell("Starter Query", 3200),
      ],
    }),
    ...data.cpcEntries
      .sort((a, b) => b.relevanceRanking - a.relevanceRanking)
      .map(
        (entry) =>
          new TableRow({
            children: [
              dataCell(entry.cpcCode, 1600, true),
              dataCell(entry.plainEnglishFocus, 2800),
              dataCell(entry.keywords.join(", "), 2800),
              dataCell(
                entry.starterQueries.length > 0 ? entry.starterQueries[0] : "",
                3200,
                true
              ),
            ],
          })
      ),
  ];

  const matrixTable = new Table({
    rows: matrixRows,
    width: { size: 10400, type: WidthType.DXA },
  });

  // Combined Queries heading
  const combinedSection: Paragraph[] = [];
  if (data.combinedQueries.length > 0) {
    combinedSection.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Best Combined Searches",
            bold: true,
            font: FONT,
            size: 26,
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    for (const cq of data.combinedQueries) {
      combinedSection.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${cq.description}: `,
              bold: true,
              font: FONT,
              size: 20,
            }),
          ],
          spacing: { before: 120, after: 40 },
        })
      );
      combinedSection.push(
        new Paragraph({
          children: [
            new TextRun({
              text: cq.queryString,
              font: "Courier New",
              size: 18,
              color: "333333",
            }),
          ],
          spacing: { after: 120 },
          indent: { left: 400 },
        })
      );
    }
  }

  // Search Workflow
  const workflowSection: Paragraph[] = [];
  if (data.searchWorkflow?.passes?.length > 0) {
    workflowSection.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Recommended Search Workflow",
            bold: true,
            font: FONT,
            size: 26,
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    );

    const workflowRows = [
      new TableRow({
        children: [
          headerCell("Step", 800),
          headerCell("What to Run", 3200),
          headerCell("What You Are Looking For", 6400),
        ],
      }),
      ...data.searchWorkflow.passes.map(
        (pass) =>
          new TableRow({
            children: [
              dataCell(`${pass.step}. ${pass.name}`, 800),
              dataCell(pass.description, 3200),
              dataCell(pass.whatToLookFor, 6400),
            ],
          })
      ),
    ];

    workflowSection.push(
      new Paragraph({ children: [], spacing: { after: 0 } })
    );

    const workflowTable = new Table({
      rows: workflowRows,
      width: { size: 10400, type: WidthType.DXA },
    });

    // We need to handle tables alongside paragraphs
    // Tables and paragraphs are both valid section children
    const allChildren: (Paragraph | Table)[] = [
      ...children,
      matrixTable,
      ...combinedSection,
      workflowTable,
    ];

    // Strongest Terms
    if (data.strongestTerms) {
      allChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "Strongest Search Terms",
              bold: true,
              font: FONT,
              size: 26,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );

      const termCategories = [
        { label: "Structure Terms", terms: data.strongestTerms.structureTerms },
        { label: "Conversion Terms", terms: data.strongestTerms.conversionTerms },
        { label: "Cleanup Terms", terms: data.strongestTerms.cleanupTerms },
        { label: "Input Format Terms", terms: data.strongestTerms.inputFormatTerms },
      ];

      for (const cat of termCategories) {
        if (cat.terms.length > 0) {
          allChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${cat.label}: `,
                  bold: true,
                  font: FONT,
                  size: 20,
                }),
                new TextRun({
                  text: cat.terms.join(", "),
                  font: FONT,
                  size: 20,
                }),
              ],
              spacing: { before: 80, after: 80 },
            })
          );
        }
      }
    }

    // Prior Art Risk Areas
    if (data.priorArtRiskAreas.length > 0) {
      allChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "Prior Art Risk Areas",
              bold: true,
              font: FONT,
              size: 26,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );

      for (const area of data.priorArtRiskAreas) {
        allChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: area.area,
                bold: true,
                font: FONT,
                size: 20,
              }),
            ],
            spacing: { before: 120, after: 40 },
          })
        );
        allChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: area.description,
                font: FONT,
                size: 20,
              }),
            ],
            spacing: { after: 40 },
            indent: { left: 400 },
          })
        );
        if (area.likelyCpcCodes.length > 0) {
          allChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `Likely CPC codes: ${area.likelyCpcCodes.join(", ")}`,
                  font: FONT,
                  size: 18,
                  italics: true,
                  color: "666666",
                }),
              ],
              spacing: { after: 120 },
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
          children: allChildren,
        },
      ],
    });

    return Buffer.from(await Packer.toBuffer(doc));
  }

  // Fallback if no workflow
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: MARGINS,
          },
        },
        children: [...children, matrixTable, ...combinedSection],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
