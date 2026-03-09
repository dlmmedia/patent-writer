import type { PatentWithRelations, SectionType, ReferenceNumeral } from "@/lib/types";
import { SECTION_LABELS } from "@/lib/types";
import {
  getDocumentStats,
  formatInventorFull,
} from "@/lib/patent/inid-codes";
import type { Inventor, RelatedApplication } from "@/lib/db/schema";

export interface UsptoExportOptions {
  pageSize: "LETTER" | "A4";
  fontSize: number;
  includeParagraphNumbers: boolean;
  includeLineNumbers: boolean;
  patentNumber?: string;
  patentDate?: string;
}

const DEFAULT_OPTIONS: UsptoExportOptions = {
  pageSize: "LETTER",
  fontSize: 9,
  includeParagraphNumbers: true,
  includeLineNumbers: true,
};

const SPEC_SECTIONS: SectionType[] = [
  "cross_reference",
  "field_of_invention",
  "background",
  "summary",
  "brief_description_drawings",
  "detailed_description",
];

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtDateLong(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function fmtParaNum(n: number): string {
  return `[${String(n).padStart(4, "0")}]`;
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function getSectionContent(
  patent: PatentWithRelations,
  type: SectionType
): string {
  return patent.sections.find((s) => s.sectionType === type)?.plainText || "";
}

function formatPatentNumber(num: string | null | undefined): string {
  if (!num) return "";
  const digits = num.replace(/\D/g, "");
  if (digits.length <= 3) return num;
  const parts: string[] = [];
  let remaining = digits;
  while (remaining.length > 3) {
    parts.unshift(remaining.slice(-3));
    remaining = remaining.slice(0, -3);
  }
  if (remaining) parts.unshift(remaining);
  return parts.join(",");
}

function generateBarcodeSvg(patentNumber: string): string {
  const code = `US${patentNumber.replace(/\D/g, "").padStart(11, "0")}A`;
  let bars = "";
  let x = 0;
  for (let i = 0; i < code.length; i++) {
    const charCode = code.charCodeAt(i);
    for (let b = 7; b >= 0; b--) {
      if ((charCode >> b) & 1) {
        bars += `<rect x="${x}" y="0" width="1" height="40" fill="black"/>`;
      }
      x += 1;
    }
    x += 1;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x} 45" width="${x * 1.5}" height="50">${bars}</svg>`;
}

function renderCoverPage(
  patent: PatentWithRelations,
  opts: UsptoExportOptions
): string {
  const inventors = (patent.inventors as Inventor[] | null) || [];
  const related = (patent.relatedApplications as RelatedApplication[] | null) || [];
  const docStats = getDocumentStats(patent);
  const patNum = opts.patentNumber || patent.publicationNumber || patent.applicationNumber || "";
  const patDate = opts.patentDate
    ? opts.patentDate
    : patent.filingDate
      ? fmtDate(patent.filingDate)
      : "";
  const formattedPatNum = formatPatentNumber(patNum);
  const docId = `US${(patNum || "").replace(/\D/g, "").padStart(11, "0")}A`;

  const firstInventorSurname = inventors.length > 0
    ? (inventors[0].familyName || inventors[0].name?.split(" ").pop() || "")
    : "";
  const inventorLine = inventors.length > 1
    ? `${firstInventorSurname} et al.`
    : firstInventorSurname;

  // Build left column content
  let leftCol = "";

  // Title
  leftCol += `<div class="cover-field">
    <span class="inid-code">[54]</span>
    <div class="cover-field-content">
      <strong class="cover-title">${esc(patent.title).toUpperCase()}</strong>
    </div>
  </div>`;

  // Inventors
  if (inventors.length > 0) {
    const invCode = patent.jurisdiction === "US" ? "[76]" : "[72]";
    const invLines = inventors
      .map((inv) => esc(formatInventorFull(inv)))
      .join(";<br/>");
    leftCol += `<div class="cover-field">
      <span class="inid-code">${invCode}</span>
      <div class="cover-field-content">
        <strong>Inventor${inventors.length > 1 ? "s" : ""}:</strong> ${invLines}
      </div>
    </div>`;
  }

  // Application number
  if (patent.applicationNumber) {
    leftCol += `<div class="cover-field">
      <span class="inid-code">[21]</span>
      <div class="cover-field-content">
        <strong>Appl. No.:</strong> ${esc(patent.applicationNumber)}
      </div>
    </div>`;
  }

  // Filing date
  if (patent.filingDate) {
    leftCol += `<div class="cover-field">
      <span class="inid-code">[22]</span>
      <div class="cover-field-content">
        <strong>Filed:</strong> ${fmtDateLong(patent.filingDate)}
      </div>
    </div>`;
  }

  // Related application data
  if (related.length > 0) {
    leftCol += `<div class="cover-subsection"><strong>Related U.S. Application Data</strong></div>`;
    const typeLabels: Record<string, string> = {
      provisional: "Provisional application",
      continuation: "Continuation of",
      divisional: "Division of",
      cip: "Continuation-in-part of",
    };
    for (const app of related) {
      const code = app.type === "cip" || app.type === "continuation" ? "[63]" : app.type === "divisional" ? "[62]" : "[60]";
      const parts = [typeLabels[app.type] || app.type];
      if (app.applicationNumber) parts.push(`Ser. No. ${app.applicationNumber}`);
      if (app.filingDate) parts.push(app.filingDate);
      leftCol += `<div class="cover-field">
        <span class="inid-code">${code}</span>
        <div class="cover-field-content">${esc(parts.join(", "))}</div>
      </div>`;
    }
  }

  // CPC/Int. Cl.
  const cpcCodes = (patent.cpcCodes as string[] | null) || [];
  if (cpcCodes.length > 0) {
    leftCol += `<div class="cover-field">
      <span class="inid-code">[51]</span>
      <div class="cover-field-content">
        <strong>Int. Cl.</strong> <span class="dotted-leader"></span> ${esc(cpcCodes.join("; "))}
      </div>
    </div>`;
  }

  // Assignee
  if (patent.assignee) {
    leftCol += `<div class="cover-field">
      <span class="inid-code">[73]</span>
      <div class="cover-field-content">
        <strong>Assignee:</strong> ${esc(patent.assignee)}
      </div>
    </div>`;
  }

  // Build right column content
  let rightCol = "";

  // Abstract
  const abstractText = getSectionContent(patent, "abstract");
  if (abstractText) {
    const truncated = abstractText.split(/\s+/).slice(0, 150).join(" ");
    rightCol += `<div class="cover-abstract">
      <div class="cover-abstract-heading"><span class="inid-code">[57]</span> <strong>ABSTRACT</strong></div>
      <div class="cover-abstract-text">${esc(truncated)}</div>
    </div>`;
  }

  // Stats line
  rightCol += `<div class="cover-stats">
    <strong>${docStats.claimCount} Claim${docStats.claimCount !== 1 ? "s" : ""}, ${docStats.drawingSheetCount} Drawing Sheet${docStats.drawingSheetCount !== 1 ? "s" : ""}</strong>
  </div>`;

  // Representative figure
  const sortedDrawings = [...patent.drawings].sort((a, b) => {
    const na = parseInt(a.figureNumber) || 0;
    const nb = parseInt(b.figureNumber) || 0;
    return na - nb;
  });
  let representativeFigure = "";
  if (sortedDrawings.length > 0) {
    const firstDrawing = sortedDrawings[0];
    const imgUrl = firstDrawing.processedUrl || firstDrawing.originalUrl;
    if (imgUrl) {
      representativeFigure = `<div class="cover-figure">
        <img src="${esc(imgUrl)}" alt="FIG. ${esc(firstDrawing.figureNumber)}" />
      </div>`;
    }
  }

  return `<div class="cover-page">
    <div class="cover-barcode">
      ${generateBarcodeSvg(patNum)}
      <div class="cover-doc-id">${esc(docId)}</div>
    </div>
    <div class="cover-header">
      <div class="cover-header-left">
        <div class="cover-us-patent">United States Patent <span class="inid-small">[19]</span></div>
        <div class="cover-inventor-line">${esc(inventorLine)}</div>
      </div>
      <div class="cover-header-right">
        <div class="cover-pat-label"><span class="inid-code">[11]</span> <strong>Patent Number:</strong></div>
        <div class="cover-pat-number">${esc(formattedPatNum)}</div>
        <div class="cover-pat-label"><span class="inid-code">[45]</span> <strong>Date of Patent:</strong></div>
        <div class="cover-pat-date">${esc(patDate)}</div>
      </div>
    </div>
    <hr class="cover-rule thick" />
    <div class="cover-body">
      <div class="cover-left-col">${leftCol}</div>
      <div class="cover-right-col">${rightCol}</div>
    </div>
    ${representativeFigure}
  </div>`;
}

function renderDrawingPages(
  patent: PatentWithRelations,
  opts: UsptoExportOptions
): string {
  const sortedDrawings = [...patent.drawings].sort((a, b) => {
    const pa = parseInt(a.figureNumber) || 0;
    const pb = parseInt(b.figureNumber) || 0;
    return pa - pb;
  });
  const totalSheets = sortedDrawings.length;
  if (totalSheets === 0) return "";

  const patNum = formatPatentNumber(
    opts.patentNumber || patent.publicationNumber || patent.applicationNumber || ""
  );
  const patDate = opts.patentDate
    ? opts.patentDate
    : patent.filingDate
      ? fmtDate(patent.filingDate)
      : "";

  return sortedDrawings
    .map((drawing, idx) => {
      const imgUrl = drawing.processedUrl || drawing.originalUrl;
      const imgHtml = imgUrl
        ? `<img src="${esc(imgUrl)}" class="drawing-image" alt="FIG. ${esc(drawing.figureNumber)}" />`
        : `<div class="drawing-placeholder">[Drawing Placeholder]</div>`;

      return `<div class="drawing-page">
        <div class="drawing-header">
          <span>U.S. Patent</span>
          <span>${esc(patDate)}</span>
          <span>Sheet ${idx + 1} of ${totalSheets}</span>
          <span>${esc(patNum)}</span>
        </div>
        <div class="drawing-body">
          ${imgHtml}
          <div class="drawing-label">FIG. ${esc(drawing.figureNumber)}</div>
          ${drawing.figureLabel ? `<div class="drawing-sublabel">${esc(drawing.figureLabel)}</div>` : ""}
        </div>
      </div>`;
    })
    .join("\n");
}

function renderSpecificationBody(
  patent: PatentWithRelations,
  opts: UsptoExportOptions
): string {
  const patNum = formatPatentNumber(
    opts.patentNumber || patent.publicationNumber || patent.applicationNumber || ""
  );

  let html = "";
  let paraCounter = 1;

  // Title block (spans both columns)
  html += `<div class="spec-title-block">
    <div class="spec-patent-number">${esc(patNum)}</div>
  </div>`;

  // Title of invention as first heading
  html += `<div class="spec-columns">`;
  html += `<h2 class="spec-section-heading column-span">${esc(patent.title).toUpperCase()}</h2>`;

  for (const sectionType of SPEC_SECTIONS) {
    const content = getSectionContent(patent, sectionType);
    if (!content) continue;

    const label = SECTION_LABELS[sectionType].toUpperCase();
    html += `<h2 class="spec-section-heading">${esc(label)}</h2>`;

    const paragraphs = splitIntoParagraphs(content);
    for (const para of paragraphs) {
      if (opts.includeParagraphNumbers) {
        html += `<p class="spec-para"><span class="para-num">${fmtParaNum(paraCounter)}</span>${esc(para)}</p>`;
        paraCounter++;
      } else {
        html += `<p class="spec-para">${esc(para)}</p>`;
      }
    }
  }

  html += `</div>`; // close spec-columns

  return `<div class="spec-body-pages">${html}</div>`;
}

function renderClaimsSection(
  patent: PatentWithRelations,
  opts: UsptoExportOptions
): string {
  if (patent.claims.length === 0) return "";

  const patNum = formatPatentNumber(
    opts.patentNumber || patent.publicationNumber || patent.applicationNumber || ""
  );

  let html = `<div class="claims-section">
    <div class="spec-title-block">
      <div class="spec-patent-number">${esc(patNum)}</div>
    </div>
    <div class="spec-columns">
      <h2 class="spec-section-heading">CLAIMS</h2>
      <p class="spec-para claims-preamble">What is claimed is:</p>`;

  for (const claim of patent.claims) {
    const isDependent = claim.isIndependent === false;
    html += `<p class="spec-para claim-text ${isDependent ? "dependent-claim" : "independent-claim"}">
      <strong>${claim.claimNumber}.</strong> ${esc(claim.fullText)}
    </p>`;
  }

  html += `</div></div>`;
  return html;
}

function renderAbstractPage(
  patent: PatentWithRelations,
  opts: UsptoExportOptions
): string {
  const abstractText = getSectionContent(patent, "abstract");
  if (!abstractText) return "";

  const patNum = formatPatentNumber(
    opts.patentNumber || patent.publicationNumber || patent.applicationNumber || ""
  );
  const truncated = abstractText.split(/\s+/).slice(0, 150).join(" ");

  return `<div class="abstract-page">
    <div class="spec-title-block">
      <div class="spec-patent-number">${esc(patNum)}</div>
    </div>
    <div class="spec-columns">
      <h2 class="spec-section-heading">ABSTRACT</h2>
      <p class="spec-para abstract-text">${esc(truncated)}</p>
    </div>
  </div>`;
}

function renderReferenceNumerals(
  patent: PatentWithRelations,
  opts: UsptoExportOptions
): string {
  const refNumerals = (patent.referenceNumerals || [])
    .slice()
    .sort((a: ReferenceNumeral, b: ReferenceNumeral) => a.numeral - b.numeral);
  if (refNumerals.length === 0) return "";

  const patNum = formatPatentNumber(
    opts.patentNumber || patent.publicationNumber || patent.applicationNumber || ""
  );

  let rows = refNumerals
    .map(
      (rn) =>
        `<tr><td class="ref-num">${rn.numeral}</td><td class="ref-name">${esc(rn.elementName)}</td></tr>`
    )
    .join("\n");

  return `<div class="ref-numerals-page">
    <div class="spec-title-block">
      <div class="spec-patent-number">${esc(patNum)}</div>
    </div>
    <div class="spec-columns">
      <h2 class="spec-section-heading">REFERENCE NUMERALS</h2>
      <table class="ref-table">
        <thead><tr><th>NO.</th><th>ELEMENT</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

function getStyles(opts: UsptoExportOptions): string {
  const pageW = opts.pageSize === "LETTER" ? "8.5in" : "210mm";
  const pageH = opts.pageSize === "LETTER" ? "11in" : "297mm";
  const fs = opts.fontSize;

  return `
    @page {
      size: ${pageW} ${pageH};
      margin: 0;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: "Times New Roman", "Times", "Nimbus Roman", serif;
      font-size: ${fs}pt;
      line-height: 1.35;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── Cover Page ──────────────────────────────────── */

    .cover-page {
      width: ${pageW};
      height: ${pageH};
      padding: 0.4in 0.5in 0.4in 0.5in;
      page-break-after: always;
      position: relative;
      display: flex;
      flex-direction: column;
    }

    .cover-barcode {
      text-align: center;
      margin-bottom: 6px;
    }

    .cover-doc-id {
      font-size: 7pt;
      letter-spacing: 1px;
      text-align: center;
      margin-top: 2px;
    }

    .cover-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 4px;
    }

    .cover-header-left {
      flex: 1;
    }

    .cover-us-patent {
      font-size: 16pt;
      font-weight: bold;
      line-height: 1.2;
    }

    .inid-small {
      font-size: 9pt;
      font-weight: normal;
      vertical-align: super;
    }

    .cover-inventor-line {
      font-size: 11pt;
      margin-top: 2px;
    }

    .cover-header-right {
      text-align: right;
      min-width: 200px;
    }

    .cover-pat-label {
      font-size: 9pt;
    }

    .cover-pat-number {
      font-size: 18pt;
      font-weight: bold;
      margin-bottom: 4px;
    }

    .cover-pat-date {
      font-size: 11pt;
      margin-bottom: 2px;
    }

    .cover-rule {
      border: none;
      border-top: 2px solid #000;
      margin: 6px 0;
    }

    .cover-rule.thick {
      border-top-width: 3px;
    }

    .cover-body {
      display: flex;
      gap: 16px;
      flex: 1;
      min-height: 0;
    }

    .cover-left-col {
      flex: 1;
      border-right: 1px solid #999;
      padding-right: 12px;
      font-size: ${Math.max(fs - 1, 7)}pt;
      overflow: hidden;
    }

    .cover-right-col {
      flex: 1;
      padding-left: 4px;
      font-size: ${Math.max(fs - 1, 7)}pt;
      display: flex;
      flex-direction: column;
    }

    .cover-field {
      display: flex;
      gap: 4px;
      margin-bottom: 4px;
      line-height: 1.3;
    }

    .inid-code {
      font-weight: bold;
      font-size: ${Math.max(fs - 1, 7)}pt;
      white-space: nowrap;
      min-width: 24px;
    }

    .cover-field-content {
      flex: 1;
    }

    .cover-title {
      font-size: ${fs + 1}pt;
      display: block;
      margin-bottom: 2px;
    }

    .cover-subsection {
      margin: 6px 0 3px;
      text-align: center;
      font-size: ${Math.max(fs - 1, 7)}pt;
    }

    .cover-abstract {
      flex: 1;
    }

    .cover-abstract-heading {
      text-align: center;
      margin-bottom: 6px;
      font-size: ${fs}pt;
    }

    .cover-abstract-text {
      text-align: justify;
      font-size: ${Math.max(fs - 1, 7)}pt;
      line-height: 1.35;
    }

    .cover-stats {
      text-align: center;
      margin-top: 8px;
      font-size: ${fs}pt;
    }

    .cover-figure {
      text-align: center;
      margin-top: 8px;
      flex-shrink: 0;
    }

    .cover-figure img {
      max-width: 100%;
      max-height: 2.8in;
      object-fit: contain;
    }

    /* ── Drawing Pages ───────────────────────────────── */

    .drawing-page {
      width: ${pageW};
      height: ${pageH};
      padding: 0.5in 0.75in;
      page-break-after: always;
      display: flex;
      flex-direction: column;
    }

    .drawing-header {
      display: flex;
      justify-content: space-between;
      font-size: 9pt;
      padding-bottom: 4px;
      border-bottom: 1px solid #000;
      margin-bottom: 12px;
    }

    .drawing-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }

    .drawing-image {
      max-width: 90%;
      max-height: 7.5in;
      object-fit: contain;
    }

    .drawing-placeholder {
      font-size: 14pt;
      color: #999;
      font-style: italic;
    }

    .drawing-label {
      font-weight: bold;
      font-size: 11pt;
      margin-top: 12px;
      text-align: center;
    }

    .drawing-sublabel {
      font-style: italic;
      font-size: 9pt;
      color: #555;
      text-align: center;
      margin-top: 4px;
    }

    /* ── Specification Body (Two-Column) ─────────────── */

    .spec-body-pages,
    .claims-section,
    .abstract-page,
    .ref-numerals-page {
      width: ${pageW};
      padding: 0.5in 0.65in 0.6in 0.65in;
      page-break-after: always;
    }

    .spec-title-block {
      text-align: center;
      margin-bottom: 8px;
    }

    .spec-patent-number {
      font-size: 12pt;
      font-weight: bold;
      letter-spacing: 0.5px;
    }

    .spec-columns {
      column-count: 2;
      column-gap: 0.3in;
      column-rule: 1px solid #ccc;
      font-size: ${fs}pt;
      text-align: justify;
      line-height: 1.4;
      orphans: 3;
      widows: 3;
    }

    .spec-section-heading {
      font-size: ${fs + 0.5}pt;
      font-weight: bold;
      text-align: center;
      text-transform: uppercase;
      margin: 12px 0 6px;
      break-after: avoid;
      line-height: 1.3;
    }

    .spec-section-heading.column-span {
      column-span: all;
      margin-top: 0;
    }

    .spec-para {
      margin-bottom: 6px;
      text-indent: 0.25in;
      text-align: justify;
      break-inside: avoid-column;
    }

    .spec-para:first-of-type {
      text-indent: 0;
    }

    .para-num {
      font-weight: bold;
      font-size: ${Math.max(fs - 1, 7)}pt;
      margin-right: 6px;
      display: inline;
    }

    /* ── Claims ──────────────────────────────────────── */

    .claims-preamble {
      font-style: italic;
      text-indent: 0;
    }

    .claim-text {
      text-indent: 0;
      margin-bottom: 8px;
    }

    .dependent-claim {
      padding-left: 0.25in;
    }

    /* ── Abstract ────────────────────────────────────── */

    .abstract-text {
      text-indent: 0.25in;
    }

    /* ── Reference Numerals ──────────────────────────── */

    .ref-table {
      width: 100%;
      border-collapse: collapse;
      font-size: ${Math.max(fs - 1, 7)}pt;
      break-inside: auto;
    }

    .ref-table th {
      font-weight: bold;
      text-align: left;
      border-bottom: 2px solid #333;
      padding: 2px 6px;
    }

    .ref-table td {
      border-bottom: 1px solid #ddd;
      padding: 2px 6px;
    }

    .ref-num {
      font-weight: bold;
      width: 60px;
    }

    /* ── Print Overrides ─────────────────────────────── */

    @media print {
      body { -webkit-print-color-adjust: exact; }
    }
  `;
}

export function generatePatentHtml(
  patent: PatentWithRelations,
  options?: Partial<UsptoExportOptions>
): string {
  const opts: UsptoExportOptions = { ...DEFAULT_OPTIONS, ...options };

  const coverPage = renderCoverPage(patent, opts);
  const drawingPages = renderDrawingPages(patent, opts);
  const specBody = renderSpecificationBody(patent, opts);
  const claimsSection = renderClaimsSection(patent, opts);
  const abstractPage = renderAbstractPage(patent, opts);
  const refNumerals = renderReferenceNumerals(patent, opts);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(patent.title)} — Patent Application</title>
  <style>${getStyles(opts)}</style>
</head>
<body>
  ${coverPage}
  ${drawingPages}
  ${specBody}
  ${claimsSection}
  ${abstractPage}
  ${refNumerals}
</body>
</html>`;
}
