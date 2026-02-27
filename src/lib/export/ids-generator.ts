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
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";
import type { PatentWithRelations, PriorArtResult } from "@/lib/types";

const TABLE_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
};

function headerCell(text: string, width?: number): TableCell {
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    borders: TABLE_BORDERS,
    shading: { fill: "E8E8E8" },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 60, after: 60 },
        children: [
          new TextRun({
            text,
            bold: true,
            font: "Times New Roman",
            size: 18,
          }),
        ],
      }),
    ],
  });
}

function dataCell(text: string): TableCell {
  return new TableCell({
    borders: TABLE_BORDERS,
    children: [
      new Paragraph({
        spacing: { before: 40, after: 40 },
        children: [
          new TextRun({
            text: text || "—",
            font: "Times New Roman",
            size: 18,
          }),
        ],
      }),
    ],
  });
}

function createIDSTable(
  results: PriorArtResult[],
  columns: string[]
): Table {
  const headerRow = new TableRow({
    children: columns.map((col) => headerCell(col)),
    tableHeader: true,
  });

  const dataRows = results.map(
    (result) =>
      new TableRow({
        children: [
          dataCell(result.externalPatentNumber || "N/A"),
          dataCell(result.assignee || "Unknown"),
          dataCell(result.filingDate || "Unknown"),
          dataCell(result.title || ""),
        ],
      })
  );

  if (dataRows.length === 0) {
    dataRows.push(
      new TableRow({
        children: columns.map(() => dataCell("None")),
      })
    );
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  });
}

export async function generateIDS(
  patent: PatentWithRelations,
  priorArtResults: PriorArtResult[]
): Promise<Buffer> {
  const idsResults = priorArtResults.filter((r) => r.addedToIds);

  const usPatents = idsResults.filter((r) => {
    const num = r.externalPatentNumber?.toUpperCase() || "";
    return num.startsWith("US") || num.startsWith("RE");
  });

  const foreignPatents = idsResults.filter((r) => {
    const num = r.externalPatentNumber?.toUpperCase() || "";
    return (
      !num.startsWith("US") &&
      !num.startsWith("RE") &&
      r.externalPatentNumber &&
      r.sourceApi !== "scholar"
    );
  });

  const nonPatentLit = idsResults.filter(
    (r) => !r.externalPatentNumber || r.sourceApi === "scholar"
  );

  const tableColumns = [
    "Document Number",
    "Name of Patentee / Applicant",
    "Date",
    "Pages, Columns, Lines Where Relevant Passages Appear",
  ];

  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 },
      children: [
        new TextRun({
          text: "INFORMATION DISCLOSURE STATEMENT",
          bold: true,
          font: "Times New Roman",
          size: 28,
        }),
      ],
    })
  );

  // Application info
  children.push(
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: "Application Title: ",
          bold: true,
          font: "Times New Roman",
          size: 22,
        }),
        new TextRun({
          text: patent.title,
          font: "Times New Roman",
          size: 22,
        }),
      ],
    })
  );

  const inventors = patent.inventors as { name: string }[] | null;
  if (inventors && inventors.length > 0) {
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: "Applicant(s): ",
            bold: true,
            font: "Times New Roman",
            size: 22,
          }),
          new TextRun({
            text: inventors.map((i) => i.name).join("; "),
            font: "Times New Roman",
            size: 22,
          }),
        ],
      })
    );
  }

  children.push(new Paragraph({ spacing: { after: 360 } }));

  const sections: (Paragraph | Table)[] = [...children];

  // U.S. Patent Documents
  sections.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 360, after: 240 },
      children: [
        new TextRun({
          text: "U.S. PATENT DOCUMENTS",
          bold: true,
          font: "Times New Roman",
          size: 22,
        }),
      ],
    })
  );
  sections.push(createIDSTable(usPatents, tableColumns));

  // Foreign Patent Documents
  sections.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 360, after: 240 },
      children: [
        new TextRun({
          text: "FOREIGN PATENT DOCUMENTS",
          bold: true,
          font: "Times New Roman",
          size: 22,
        }),
      ],
    })
  );
  sections.push(createIDSTable(foreignPatents, tableColumns));

  // Non-Patent Literature
  sections.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 360, after: 240 },
      children: [
        new TextRun({
          text: "NON-PATENT LITERATURE",
          bold: true,
          font: "Times New Roman",
          size: 22,
        }),
      ],
    })
  );
  sections.push(createIDSTable(nonPatentLit, tableColumns));

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
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
                    text: "Information Disclosure Statement",
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
        children: sections,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
