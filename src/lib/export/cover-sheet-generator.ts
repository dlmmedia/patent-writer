import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  CheckBox,
} from "docx";
import type { PatentWithRelations } from "@/lib/types";
import type { Inventor, CorrespondenceAddress, GovernmentContract } from "@/lib/db/schema";
import { formatInventorName, formatInventorResidence } from "@/lib/patent/inid-codes";

const FONT = "Times New Roman";
const HP = 20; // 10pt in half-points

const FEES: Record<string, { filing: number; sizeExtra: number }> = {
  micro: { filing: 65, sizeExtra: 90 },
  small: { filing: 160, sizeExtra: 180 },
  large: { filing: 320, sizeExtra: 450 },
};

function text(content: string, opts?: { bold?: boolean; size?: number; color?: string; italics?: boolean }): TextRun {
  return new TextRun({
    text: content,
    font: FONT,
    size: opts?.size || HP,
    bold: opts?.bold,
    color: opts?.color,
    italics: opts?.italics,
  });
}

function para(children: TextRun[], opts?: { spacing?: { before?: number; after?: number }; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType] }): Paragraph {
  return new Paragraph({
    spacing: opts?.spacing || { after: 100 },
    alignment: opts?.alignment,
    children,
  });
}

function heading(content: string): Paragraph {
  return para([text(content, { bold: true, size: 22 })], {
    spacing: { before: 200, after: 100 },
    alignment: AlignmentType.CENTER,
  });
}

function labelValue(label: string, value: string): Paragraph {
  return para([
    text(`${label}: `, { bold: true }),
    text(value || "_______________"),
  ]);
}

function checkboxLine(label: string, checked: boolean): Paragraph {
  return para([
    text(checked ? "[X] " : "[ ] ", { bold: true }),
    text(label),
  ]);
}

function buildInventorRows(inventors: Inventor[]): TableRow[] {
  const cellBorders = {
    top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
    right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
  };

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        width: { size: 40, type: WidthType.PERCENTAGE },
        borders: cellBorders,
        children: [para([text("Given Name (first and middle [if any])", { bold: true, size: 18 })])],
      }),
      new TableCell({
        width: { size: 30, type: WidthType.PERCENTAGE },
        borders: cellBorders,
        children: [para([text("Family Name or Surname", { bold: true, size: 18 })])],
      }),
      new TableCell({
        width: { size: 30, type: WidthType.PERCENTAGE },
        borders: cellBorders,
        children: [para([text("Residence (City and either State or Foreign Country)", { bold: true, size: 18 })])],
      }),
    ],
  });

  const dataRows = inventors.map(
    (inv) =>
      new TableRow({
        children: [
          new TableCell({
            borders: cellBorders,
            children: [para([text(inv.givenName || inv.name || "", { size: 18 })])],
          }),
          new TableCell({
            borders: cellBorders,
            children: [para([text(inv.familyName || "", { size: 18 })])],
          }),
          new TableCell({
            borders: cellBorders,
            children: [para([text(formatInventorResidence(inv), { size: 18 })])],
          }),
        ],
      })
  );

  if (dataRows.length === 0) {
    dataRows.push(
      new TableRow({
        children: [
          new TableCell({ borders: cellBorders, children: [para([text("", { size: 18 })])] }),
          new TableCell({ borders: cellBorders, children: [para([text("", { size: 18 })])] }),
          new TableCell({ borders: cellBorders, children: [para([text("", { size: 18 })])] }),
        ],
      })
    );
  }

  return [headerRow, ...dataRows];
}

export async function generateCoverSheet(
  patent: PatentWithRelations
): Promise<Buffer> {
  const inventors = (patent.inventors as Inventor[] | null) || [];
  const correspondence = patent.correspondenceAddress as CorrespondenceAddress | null;
  const govContract = patent.governmentContract as GovernmentContract | null;
  const entitySize = patent.entitySize || "small";
  const fees = FEES[entitySize];

  const specWordCount = patent.sections.reduce((s, sec) => s + (sec.wordCount || 0), 0);
  const estimatedPages = Math.max(1, Math.ceil(specWordCount / 250));
  const drawingSheets = patent.drawings.length;
  const totalSheets = estimatedPages + drawingSheets;
  const extraFee = totalSheets > 100 ? Math.ceil((totalSheets - 100) / 50) * fees.sizeExtra : 0;
  const totalFee = fees.filing + extraFee;

  // ─── Page 1 ────────────────────────────────────────────────

  const page1: (Paragraph | Table)[] = [];

  page1.push(para([text("PTO/SB/16 (01-25)", { size: 16, color: "666666" })], { alignment: AlignmentType.RIGHT }));
  page1.push(para([text("Approved for use through 11/30/2027. OMB 0651-0032", { size: 14, color: "666666" })], { alignment: AlignmentType.RIGHT }));
  page1.push(para([text("U.S. Patent and Trademark Office; U.S. DEPARTMENT OF COMMERCE", { size: 16, color: "666666" })], { alignment: AlignmentType.CENTER }));

  page1.push(heading("PROVISIONAL APPLICATION FOR PATENT COVER SHEET"));

  page1.push(para([
    text("This is a request for filing a ", { size: 18 }),
    text("PROVISIONAL APPLICATION FOR PATENT", { bold: true, size: 18 }),
    text(" under 37 CFR 1.53(c).", { size: 18 }),
  ]));

  // Inventors table
  page1.push(para([text("INVENTOR(S)", { bold: true, size: HP })], { spacing: { before: 200, after: 100 } }));

  const inventorTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: buildInventorRows(inventors),
  });
  page1.push(inventorTable);

  if (inventors.length > 3) {
    page1.push(para([
      text(`Additional inventors are being named on the separately numbered sheets attached hereto.`, { size: 16, italics: true }),
    ]));
  }

  // Title
  page1.push(para([text("TITLE OF THE INVENTION (500 characters max):", { bold: true })], { spacing: { before: 200 } }));
  page1.push(para([text(patent.title.slice(0, 500))]));

  // Correspondence
  page1.push(para([text("CORRESPONDENCE ADDRESS", { bold: true })], { spacing: { before: 200 } }));

  if (correspondence?.customerNumber) {
    page1.push(para([text(`The address corresponding to Customer Number: ${correspondence.customerNumber}`)]));
  } else if (correspondence) {
    if (correspondence.name) page1.push(labelValue("Firm or Individual Name", correspondence.name));
    if (correspondence.address) page1.push(labelValue("Address", correspondence.address));
    const cityLine = [correspondence.city, correspondence.state, correspondence.zip].filter(Boolean).join(", ");
    if (cityLine) page1.push(labelValue("City / State / ZIP", cityLine));
    if (correspondence.country) page1.push(labelValue("Country", correspondence.country));
    if (correspondence.phone) page1.push(labelValue("Telephone", correspondence.phone));
    if (correspondence.email) page1.push(labelValue("Email", correspondence.email));
  } else {
    page1.push(para([text("_______________________________________________")]));
  }

  // Enclosed Parts
  page1.push(para([text("ENCLOSED APPLICATION PARTS (check all that apply)", { bold: true })], { spacing: { before: 200 } }));

  const hasSpec = patent.sections.some((s) => s.plainText && s.plainText.trim().length > 0);
  const hasDrawings = patent.drawings.length > 0;

  page1.push(checkboxLine(`Specification (e.g., description of the invention)    Number of Pages: ${estimatedPages}`, hasSpec));
  page1.push(checkboxLine(`Drawing(s)    Number of Sheets: ${drawingSheets}`, hasDrawings));
  page1.push(checkboxLine("Application Data Sheet. See 37 CFR 1.76.", false));

  // Entity size and fees
  page1.push(para([text("METHOD OF PAYMENT", { bold: true })], { spacing: { before: 200 } }));
  page1.push(checkboxLine(`Applicant asserts small entity status. See 37 CFR 1.27.`, entitySize === "small"));
  page1.push(checkboxLine(`Applicant certifies micro entity status. See 37 CFR 1.29.`, entitySize === "micro"));

  page1.push(para([
    text(`Filing Fee: $${fees.filing}`, { bold: true }),
    text(extraFee > 0 ? `  |  Size Fee: $${extraFee}` : ""),
    text(`  |  TOTAL FEE AMOUNT: $${totalFee}`, { bold: true }),
  ], { spacing: { before: 100 } }));

  // ─── Page 2: Government Contract ─────────────────────────

  const page2: Paragraph[] = [];

  page2.push(heading("PROVISIONAL APPLICATION FOR PATENT COVER SHEET - Page 2 of 2"));

  const isGovAgency = govContract?.isMadeByAgency || false;
  const isGovContract = govContract?.isUnderContract || false;

  page2.push(para([text("The invention was made by an agency of the United States Government or under a contract with an agency of the United States Government.", { size: 18 })]));

  page2.push(checkboxLine("No.", !isGovAgency && !isGovContract));
  page2.push(checkboxLine(
    `Yes, the invention was made by an agency of the U.S. Government. Agency: ${govContract?.agencyName || "_______________"}`,
    isGovAgency
  ));
  page2.push(checkboxLine(
    `Yes, the invention was made under a contract with a U.S. Government agency.`,
    isGovContract
  ));

  if (isGovContract) {
    page2.push(labelValue("Contract Number", govContract?.contractNumber || ""));
    page2.push(labelValue("U.S. Government Agency", govContract?.agencyName || ""));
  }

  if (isGovAgency || isGovContract) {
    page2.push(para([text(
      `In accordance with 35 U.S.C. 202(c)(6): "This invention was made with government support under ${govContract?.contractNumber || "[CONTRACT]"} awarded by ${govContract?.agencyName || "[AGENCY]"}. The government has certain rights in the invention."`,
      { size: 16, italics: true },
    )], { spacing: { before: 200 } }));
  }

  // Signature block
  page2.push(para([text("")], { spacing: { before: 400 } }));
  page2.push(para([text("SIGNATURE ________________________________________    DATE _____________")]));
  page2.push(para([text("TYPED OR PRINTED NAME _____________________________    REGISTRATION NO. __________")]));
  page2.push(para([text(`TELEPHONE ________________________________________    DOCKET NUMBER: ${patent.docketNumber || "_______________"}`)]));

  // ─── Assemble ──────────────────────────────────────────────

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1440 },
          },
        },
        children: page1,
      },
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1440 },
          },
        },
        children: page2,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
