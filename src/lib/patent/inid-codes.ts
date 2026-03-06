import type { PatentWithRelations, Jurisdiction } from "@/lib/types";
import type { Inventor, RelatedApplication, CorrespondenceAddress } from "@/lib/db/schema";

export interface INIDField {
  code: string;
  label: string;
  value: string | string[] | null;
}

const JURISDICTION_AUTHORITIES: Record<string, string> = {
  US: "United States",
  EP: "European Patent Office",
  JP: "Japan",
  CN: "China",
  PCT: "WIPO",
  KR: "Korea",
  AU: "Australia",
  CA: "Canada",
  GB: "United Kingdom",
};

const PATENT_TYPE_LABELS: Record<string, string> = {
  utility: "Patent Application Publication",
  provisional: "Provisional Application for Patent",
  design: "Design Patent Application Publication",
  pct: "International Application Publication",
};

export function formatInventorName(inventor: Inventor): string {
  if (inventor.givenName && inventor.familyName) {
    return `${inventor.givenName} ${inventor.familyName}`;
  }
  return inventor.name || `${inventor.givenName || ""} ${inventor.familyName || ""}`.trim();
}

export function formatInventorResidence(inventor: Inventor): string {
  const parts: string[] = [];
  if (inventor.city) parts.push(inventor.city);
  if (inventor.state) parts.push(inventor.state);
  if (inventor.country) parts.push(inventor.country);
  if (parts.length === 0 && inventor.address) return inventor.address;
  return parts.join(", ");
}

export function formatInventorFull(inventor: Inventor): string {
  const name = formatInventorName(inventor);
  const residence = formatInventorResidence(inventor);
  return residence ? `${name}, ${residence}` : name;
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatRelatedApplication(app: RelatedApplication): string {
  const typeLabels: Record<string, string> = {
    provisional: "U.S. Provisional Application",
    continuation: "Continuation of U.S. Application",
    divisional: "Division of U.S. Application",
    cip: "Continuation-in-Part of U.S. Application",
  };
  const parts = [typeLabels[app.type] || app.type];
  if (app.applicationNumber) parts.push(`No. ${app.applicationNumber}`);
  if (app.filingDate) parts.push(`filed ${app.filingDate}`);
  if (app.title) parts.push(`entitled "${app.title}"`);
  return parts.join(", ");
}

/**
 * Extract all INID-coded bibliographic fields from a patent.
 * Returns an ordered array ready for front-page rendering.
 */
export function getINIDFields(patent: PatentWithRelations): INIDField[] {
  const fields: INIDField[] = [];
  const inventors = (patent.inventors as Inventor[] | null) || [];
  const related = (patent.relatedApplications as RelatedApplication[] | null) || [];
  const jurisdiction = patent.jurisdiction as Jurisdiction;

  // (19) Issuing Authority
  fields.push({
    code: "(19)",
    label: "Issuing Authority",
    value: JURISDICTION_AUTHORITIES[jurisdiction] || jurisdiction,
  });

  // (12) Document Type
  fields.push({
    code: "(12)",
    label: "Document Type",
    value: PATENT_TYPE_LABELS[patent.type] || "Patent Application Publication",
  });

  // (10) Kind Code
  if (patent.kindCode) {
    fields.push({ code: "(10)", label: "Kind Code", value: patent.kindCode });
  }

  // (11) Document / Publication Number
  if (patent.publicationNumber) {
    fields.push({
      code: "(11)",
      label: "Publication Number",
      value: patent.publicationNumber,
    });
  }

  // (21) Application Number
  if (patent.applicationNumber) {
    fields.push({
      code: "(21)",
      label: "Application Number",
      value: patent.applicationNumber,
    });
  }

  // (22) Filing Date
  if (patent.filingDate) {
    fields.push({
      code: "(22)",
      label: "Filing Date",
      value: formatDate(patent.filingDate),
    });
  }

  // (45) Document Date / Grant Date
  if (patent.priorityDate) {
    fields.push({
      code: "(45)",
      label: "Priority Date",
      value: formatDate(patent.priorityDate),
    });
  }

  // (60) Provisional Application Data
  const provisionalApps = related.filter((a) => a.type === "provisional");
  if (provisionalApps.length > 0) {
    fields.push({
      code: "(60)",
      label: "Provisional Application Data",
      value: provisionalApps.map(formatRelatedApplication),
    });
  }

  // (62) Division of Application
  const divisionals = related.filter((a) => a.type === "divisional");
  if (divisionals.length > 0) {
    fields.push({
      code: "(62)",
      label: "Division of Application",
      value: divisionals.map(formatRelatedApplication),
    });
  }

  // (63) Continuation Data
  const continuations = related.filter(
    (a) => a.type === "continuation" || a.type === "cip"
  );
  if (continuations.length > 0) {
    fields.push({
      code: "(63)",
      label: "Continuation Data",
      value: continuations.map(formatRelatedApplication),
    });
  }

  // (51) International Classification
  if (patent.cpcCodes && (patent.cpcCodes as string[]).length > 0) {
    fields.push({
      code: "(51)",
      label: "Int. Cl.",
      value: (patent.cpcCodes as string[]).join("; "),
    });
  }

  // (54) Title of the Invention
  fields.push({
    code: "(54)",
    label: "Title of the Invention",
    value: patent.title,
  });

  // (71) Applicant
  if (patent.assignee) {
    fields.push({
      code: "(71)",
      label: "Applicant",
      value: patent.assignee,
    });
  }

  // (72)/(75) Inventors
  if (inventors.length > 0) {
    const code = jurisdiction === "US" ? "(75)" : "(72)";
    fields.push({
      code,
      label: "Inventor(s)",
      value: inventors.map(formatInventorFull),
    });
  }

  // (73) Assignee / Owner
  if (patent.assignee) {
    fields.push({
      code: "(73)",
      label: "Assignee",
      value: patent.assignee,
    });
  }

  // (57) Abstract
  const abstractSection = patent.sections.find(
    (s) => s.sectionType === "abstract"
  );
  if (abstractSection?.plainText) {
    fields.push({
      code: "(57)",
      label: "Abstract",
      value: abstractSection.plainText,
    });
  }

  return fields;
}

/**
 * Build the cross-reference section text from relatedApplications data.
 */
export function buildCrossReferenceText(
  related: RelatedApplication[]
): string {
  if (!related || related.length === 0) return "";

  const lines: string[] = [];

  const provisionals = related.filter((a) => a.type === "provisional");
  for (const app of provisionals) {
    const parts = [
      "This application claims the benefit of U.S. Provisional Patent Application",
    ];
    if (app.applicationNumber) parts.push(`No. ${app.applicationNumber}`);
    if (app.filingDate) parts.push(`filed ${app.filingDate}`);
    if (app.title) parts.push(`entitled "${app.title}"`);
    parts.push(
      "the entire disclosure of which is incorporated herein by reference in its entirety."
    );
    lines.push(parts.join(", ") + ".");
  }

  const continuations = related.filter((a) => a.type === "continuation");
  for (const app of continuations) {
    const parts = ["This application is a continuation of U.S. Application"];
    if (app.applicationNumber) parts.push(`No. ${app.applicationNumber}`);
    if (app.filingDate) parts.push(`filed ${app.filingDate}`);
    if (app.title) parts.push(`entitled "${app.title}"`);
    parts.push(
      "the entire disclosure of which is incorporated herein by reference."
    );
    lines.push(parts.join(", ") + ".");
  }

  const divisionals = related.filter((a) => a.type === "divisional");
  for (const app of divisionals) {
    const parts = ["This application is a division of U.S. Application"];
    if (app.applicationNumber) parts.push(`No. ${app.applicationNumber}`);
    if (app.filingDate) parts.push(`filed ${app.filingDate}`);
    if (app.title) parts.push(`entitled "${app.title}"`);
    parts.push(
      "the entire disclosure of which is incorporated herein by reference."
    );
    lines.push(parts.join(", ") + ".");
  }

  const cips = related.filter((a) => a.type === "cip");
  for (const app of cips) {
    const parts = [
      "This application is a continuation-in-part of U.S. Application",
    ];
    if (app.applicationNumber) parts.push(`No. ${app.applicationNumber}`);
    if (app.filingDate) parts.push(`filed ${app.filingDate}`);
    if (app.title) parts.push(`entitled "${app.title}"`);
    parts.push(
      "the entire disclosure of which is incorporated herein by reference."
    );
    lines.push(parts.join(", ") + ".");
  }

  return lines.join("\n\n");
}

/**
 * Build the government rights statement if applicable.
 */
export function buildGovernmentRightsStatement(
  contract: { isMadeByAgency?: boolean; isUnderContract?: boolean; agencyName?: string; contractNumber?: string } | null
): string | null {
  if (!contract) return null;
  if (!contract.isMadeByAgency && !contract.isUnderContract) return null;

  if (contract.isMadeByAgency) {
    return `This invention was made by an agency of the United States Government. The U.S. Government agency name is: ${contract.agencyName || "[AGENCY NAME]"}.`;
  }

  const contractNum = contract.contractNumber || "[CONTRACT NUMBER]";
  const agency = contract.agencyName || "[FEDERAL AGENCY]";
  return `This invention was made with government support under ${contractNum} awarded by ${agency}. The government has certain rights in the invention.`;
}

/**
 * Get statistics for the front page.
 */
export function getDocumentStats(patent: PatentWithRelations): {
  claimCount: number;
  drawingSheetCount: number;
  figureCount: number;
  specificationPages: number;
} {
  return {
    claimCount: patent.claims.length,
    drawingSheetCount: patent.drawings.length,
    figureCount: patent.drawings.length,
    specificationPages: Math.max(
      1,
      Math.ceil(
        patent.sections.reduce((sum, s) => sum + (s.wordCount || 0), 0) / 250
      )
    ),
  };
}
