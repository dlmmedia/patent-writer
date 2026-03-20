import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
  patents,
  patentSections,
  patentClaims,
  patentDrawings,
  patentDocuments,
  referenceNumerals,
  priorArtSearches,
  priorArtResults,
  priorArtSearchMatrices,
  templates,
  patentVersions,
  aiGenerations,
} from "./db/schema";

export type {
  CorrespondenceAddress,
  GovernmentContract,
  RelatedApplication,
  Inventor,
  KeyFeature,
  IntakeQA,
  CpcEntry,
  CombinedQuery,
  SearchWorkflow,
  KeywordGroup,
} from "./db/schema";

export type Patent = InferSelectModel<typeof patents>;
export type NewPatent = InferInsertModel<typeof patents>;

export type PatentSection = InferSelectModel<typeof patentSections>;
export type NewPatentSection = InferInsertModel<typeof patentSections>;

export type PatentClaim = InferSelectModel<typeof patentClaims>;
export type NewPatentClaim = InferInsertModel<typeof patentClaims>;

export type PatentDrawing = InferSelectModel<typeof patentDrawings>;
export type NewPatentDrawing = InferInsertModel<typeof patentDrawings>;

export type PatentDocument = InferSelectModel<typeof patentDocuments>;
export type NewPatentDocument = InferInsertModel<typeof patentDocuments>;

export type ReferenceNumeral = InferSelectModel<typeof referenceNumerals>;
export type NewReferenceNumeral = InferInsertModel<typeof referenceNumerals>;

export type PriorArtSearch = InferSelectModel<typeof priorArtSearches>;
export type PriorArtResult = InferSelectModel<typeof priorArtResults>;
export type PriorArtSearchMatrix = InferSelectModel<typeof priorArtSearchMatrices>;

export type Template = InferSelectModel<typeof templates>;
export type PatentVersion = InferSelectModel<typeof patentVersions>;
export type AiGeneration = InferSelectModel<typeof aiGenerations>;

export type PatentType = "utility" | "design" | "provisional" | "pct";
export type PatentStatus = "draft" | "in_progress" | "review" | "ready_to_file" | "filed" | "abandoned";
export type Jurisdiction = "US" | "EP" | "JP" | "CN" | "PCT" | "KR" | "AU" | "CA" | "GB";
export type SectionType =
  | "title"
  | "cross_reference"
  | "field_of_invention"
  | "background"
  | "summary"
  | "brief_description_drawings"
  | "detailed_description"
  | "claims"
  | "abstract";

export type ClaimType =
  | "method"
  | "system"
  | "apparatus"
  | "composition"
  | "computer_readable_medium"
  | "means_plus_function";

export type RiskLevel = "high" | "medium" | "low";
export type EntitySize = "micro" | "small" | "large";

export const SECTION_ORDER: SectionType[] = [
  "title",
  "cross_reference",
  "field_of_invention",
  "background",
  "summary",
  "brief_description_drawings",
  "detailed_description",
  "claims",
  "abstract",
];

export const SECTION_LABELS: Record<SectionType, string> = {
  title: "Title of the Invention",
  cross_reference: "Cross-Reference to Related Applications",
  field_of_invention: "Field of the Invention",
  background: "Background of the Invention",
  summary: "Summary of the Invention",
  brief_description_drawings: "Brief Description of the Drawings",
  detailed_description: "Detailed Description",
  claims: "Claims",
  abstract: "Abstract",
};

export const JURISDICTION_LABELS: Record<Jurisdiction, string> = {
  US: "United States (USPTO)",
  EP: "Europe (EPO)",
  JP: "Japan (JPO)",
  CN: "China (CNIPA)",
  PCT: "International (WIPO/PCT)",
  KR: "Korea (KIPO)",
  AU: "Australia (IP Australia)",
  CA: "Canada (CIPO)",
  GB: "United Kingdom (UKIPO)",
};

export type PatentWithRelations = Patent & {
  sections: PatentSection[];
  claims: PatentClaim[];
  drawings: PatentDrawing[];
  documents: PatentDocument[];
  referenceNumerals: ReferenceNumeral[];
  priorArtResults?: PriorArtResult[];
};
