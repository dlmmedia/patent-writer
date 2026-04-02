import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  pgEnum,
  real,
  varchar,
  serial,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const patentTypeEnum = pgEnum("patent_type", [
  "utility",
  "design",
  "provisional",
  "pct",
]);

export const patentStatusEnum = pgEnum("patent_status", [
  "draft",
  "in_progress",
  "review",
  "ready_to_file",
  "filed",
  "abandoned",
]);

export const jurisdictionEnum = pgEnum("jurisdiction", [
  "US",
  "EP",
  "JP",
  "CN",
  "PCT",
  "KR",
  "AU",
  "CA",
  "GB",
]);

export const sectionTypeEnum = pgEnum("section_type", [
  "title",
  "cross_reference",
  "field_of_invention",
  "background",
  "summary",
  "brief_description_drawings",
  "detailed_description",
  "claims",
  "abstract",
]);

export const claimTypeEnum = pgEnum("claim_type", [
  "method",
  "system",
  "apparatus",
  "composition",
  "computer_readable_medium",
  "means_plus_function",
]);

export const riskLevelEnum = pgEnum("risk_level", ["high", "medium", "low"]);

export const entitySizeEnum = pgEnum("entity_size", [
  "micro",
  "small",
  "large",
]);

// ─── Shared JSONB Types ──────────────────────────────────────

export type CorrespondenceAddress = {
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
  email?: string;
  customerNumber?: string;
};

export type GovernmentContract = {
  isMadeByAgency?: boolean;
  isUnderContract?: boolean;
  agencyName?: string;
  contractNumber?: string;
};

export type RelatedApplication = {
  type: "provisional" | "continuation" | "divisional" | "cip";
  applicationNumber?: string;
  filingDate?: string;
  title?: string;
};

export type Inventor = {
  givenName: string;
  familyName: string;
  city?: string;
  state?: string;
  country?: string;
  email?: string;
  /** Legacy flat name, kept for backward compat */
  name?: string;
  address?: string;
};

export type KeyFeature = {
  feature: string;
  description?: string;
  isNovel?: boolean;
};

export type IntakeQA = {
  question: string;
  answer: string;
  round: number;
};

// ─── Patents ─────────────────────────────────────────────────

export const patents = pgTable("patents", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull().default("Untitled Patent"),
  type: patentTypeEnum("type").notNull().default("utility"),
  status: patentStatusEnum("status").notNull().default("draft"),
  jurisdiction: jurisdictionEnum("jurisdiction").notNull().default("US"),
  cpcCodes: jsonb("cpc_codes").$type<string[]>().default([]),
  inventionDescription: text("invention_description"),
  entitySize: entitySizeEnum("entity_size").default("small"),
  aiModelConfig: jsonb("ai_model_config").$type<{
    draftingModel: string;
    claimsModel: string;
    analysisModel: string;
    imageModel: string;
  }>().default({
    draftingModel: "gemini-3.1-pro",
    claimsModel: "gemini-3.1-pro",
    analysisModel: "gemini-3.1-pro",
    imageModel: "nano-banana-2",
  }),
  technologyArea: text("technology_area"),
  inventors: jsonb("inventors").$type<Inventor[]>().default([]),
  assignee: text("assignee"),
  priorityDate: timestamp("priority_date"),
  filingDate: timestamp("filing_date"),

  // ── New bibliographic / filing fields ─────────────────────
  docketNumber: text("docket_number"),
  applicationNumber: text("application_number"),
  publicationNumber: text("publication_number"),
  kindCode: text("kind_code"),
  correspondenceAddress: jsonb("correspondence_address").$type<CorrespondenceAddress>(),
  governmentContract: jsonb("government_contract").$type<GovernmentContract>(),
  relatedApplications: jsonb("related_applications").$type<RelatedApplication[]>().default([]),

  // ── Structured invention disclosure ───────────────────────
  inventionProblem: text("invention_problem"),
  inventionSolution: text("invention_solution"),
  keyFeatures: jsonb("key_features").$type<KeyFeature[]>().default([]),
  knownPriorArt: text("known_prior_art"),

  // ── AI intake interview ───────────────────────────────────
  intakeCompleted: boolean("intake_completed").default(false),
  intakeResponses: jsonb("intake_responses").$type<IntakeQA[]>().default([]),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Patent Sections ─────────────────────────────────────────

export const patentSections = pgTable("patent_sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  patentId: uuid("patent_id")
    .notNull()
    .references(() => patents.id, { onDelete: "cascade" }),
  sectionType: sectionTypeEnum("section_type").notNull(),
  title: text("title").notNull(),
  content: jsonb("content").$type<Record<string, unknown>>(),
  plainText: text("plain_text"),
  orderIndex: integer("order_index").notNull().default(0),
  generationModel: text("generation_model"),
  isAiGenerated: boolean("is_ai_generated").default(false),
  wordCount: integer("word_count").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Patent Claims ───────────────────────────────────────────

export const patentClaims = pgTable("patent_claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  patentId: uuid("patent_id")
    .notNull()
    .references(() => patents.id, { onDelete: "cascade" }),
  claimNumber: integer("claim_number").notNull(),
  claimType: claimTypeEnum("claim_type").notNull().default("method"),
  parentClaimId: uuid("parent_claim_id"),
  transitionalPhrase: varchar("transitional_phrase", { length: 50 }).default("comprising"),
  preamble: text("preamble"),
  body: text("body"),
  fullText: text("full_text").notNull(),
  isIndependent: boolean("is_independent").notNull().default(true),
  noveltyScore: real("novelty_score"),
  breadthScore: real("breadth_score"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Patent Drawings ─────────────────────────────────────────

export const patentDrawings = pgTable("patent_drawings", {
  id: uuid("id").primaryKey().defaultRandom(),
  patentId: uuid("patent_id")
    .notNull()
    .references(() => patents.id, { onDelete: "cascade" }),
  figureNumber: varchar("figure_number", { length: 10 }).notNull(),
  figureLabel: text("figure_label").notNull(),
  figureType: varchar("figure_type", { length: 40 }),
  description: text("description"),
  originalUrl: text("original_url"),
  processedUrl: text("processed_url"),
  thumbnailUrl: text("thumbnail_url"),
  annotations: jsonb("annotations").$type<{
    numerals: { id: string; numeral: number; x: number; y: number; elementName: string }[];
    arrows: { id: string; fromX: number; fromY: number; toX: number; toY: number }[];
  }>(),
  generationPrompt: text("generation_prompt"),
  generationModel: text("generation_model"),
  sortOrder: integer("sort_order").default(0),
  previousVersions: jsonb("previous_versions").$type<
    { url: string; prompt: string; model: string; createdAt: string }[]
  >(),
  width: integer("width"),
  height: integer("height"),
  dpi: integer("dpi").default(300),
  isCompliant: boolean("is_compliant").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Patent Reference Documents ──────────────────────────────

export const patentDocuments = pgTable("patent_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  patentId: uuid("patent_id")
    .notNull()
    .references(() => patents.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  extractedText: text("extracted_text"),
  summary: text("summary"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Reference Numerals ──────────────────────────────────────

export const referenceNumerals = pgTable("reference_numerals", {
  id: uuid("id").primaryKey().defaultRandom(),
  patentId: uuid("patent_id")
    .notNull()
    .references(() => patents.id, { onDelete: "cascade" }),
  numeral: integer("numeral").notNull(),
  elementName: text("element_name").notNull(),
  firstFigureId: uuid("first_figure_id").references(() => patentDrawings.id),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Prior Art ───────────────────────────────────────────────

export type CpcEntry = {
  cpcCode: string;
  plainEnglishFocus: string;
  keywords: string[];
  starterQueries: string[];
  relevanceRanking: number;
  reclassificationNotes?: string;
};

export type CombinedQuery = {
  description: string;
  queryString: string;
};

export type SearchWorkflow = {
  passes: {
    step: number;
    name: string;
    description: string;
    whatToLookFor: string;
    queries: string[];
  }[];
};

export type KeywordGroup = {
  category: string;
  description: string;
  keywords: string[];
};

export const priorArtSearchMatrices = pgTable("prior_art_search_matrices", {
  id: uuid("id").primaryKey().defaultRandom(),
  patentId: uuid("patent_id")
    .notNull()
    .references(() => patents.id, { onDelete: "cascade" }),
  cpcEntries: jsonb("cpc_entries").$type<CpcEntry[]>().default([]),
  combinedQueries: jsonb("combined_queries").$type<CombinedQuery[]>().default([]),
  searchWorkflow: jsonb("search_workflow").$type<SearchWorkflow>(),
  keywordGroups: jsonb("keyword_groups").$type<KeywordGroup[]>().default([]),
  strongestTerms: jsonb("strongest_terms").$type<{
    structureTerms: string[];
    conversionTerms: string[];
    cleanupTerms: string[];
    inputFormatTerms: string[];
  }>(),
  priorArtRiskAreas: jsonb("prior_art_risk_areas").$type<{
    area: string;
    description: string;
    likelyCpcCodes: string[];
  }[]>().default([]),
  generatedByModel: text("generated_by_model"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const priorArtSearches = pgTable("prior_art_searches", {
  id: uuid("id").primaryKey().defaultRandom(),
  patentId: uuid("patent_id")
    .notNull()
    .references(() => patents.id, { onDelete: "cascade" }),
  query: text("query").notNull(),
  apiSources: jsonb("api_sources").$type<string[]>().default([]),
  resultCount: integer("result_count").default(0),
  keywordGroupsUsed: jsonb("keyword_groups_used").$type<KeywordGroup[]>(),
  cpcFilters: jsonb("cpc_filters").$type<string[]>(),
  searchStrategy: text("search_strategy"),
  matrixId: uuid("matrix_id").references(() => priorArtSearchMatrices.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const priorArtResults = pgTable("prior_art_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  searchId: uuid("search_id")
    .notNull()
    .references(() => priorArtSearches.id, { onDelete: "cascade" }),
  patentId: uuid("patent_id")
    .notNull()
    .references(() => patents.id, { onDelete: "cascade" }),
  externalPatentNumber: text("external_patent_number"),
  title: text("title").notNull(),
  abstract: text("abstract"),
  assignee: text("assignee"),
  filingDate: text("filing_date"),
  relevanceScore: real("relevance_score"),
  riskLevel: riskLevelEnum("risk_level").default("low"),
  aiAnalysis: text("ai_analysis"),
  sourceApi: text("source_api").notNull(),
  externalUrl: text("external_url"),
  addedToIds: boolean("added_to_ids").default(false),
  matchedQuery: text("matched_query"),
  matchedCpcCodes: jsonb("matched_cpc_codes").$type<string[]>(),
  cpcOverlapScore: real("cpc_overlap_score"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Templates ───────────────────────────────────────────────

export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  jurisdiction: jurisdictionEnum("jurisdiction").default("US"),
  patentType: patentTypeEnum("patent_type").default("utility"),
  technologyArea: text("technology_area"),
  sectionTemplates: jsonb("section_templates").$type<
    { sectionType: string; title: string; placeholder: string }[]
  >(),
  claimTemplates: jsonb("claim_templates").$type<
    { claimType: string; template: string }[]
  >(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Patent Versions ─────────────────────────────────────────

export const patentVersions = pgTable("patent_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  patentId: uuid("patent_id")
    .notNull()
    .references(() => patents.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  snapshot: jsonb("snapshot").notNull(),
  changeSummary: text("change_summary"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── AI Generation Log ───────────────────────────────────────

export const aiGenerations = pgTable("ai_generations", {
  id: uuid("id").primaryKey().defaultRandom(),
  patentId: uuid("patent_id").references(() => patents.id, { onDelete: "set null" }),
  sectionId: uuid("section_id").references(() => patentSections.id, { onDelete: "set null" }),
  model: text("model").notNull(),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  costUsd: real("cost_usd"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Relations ───────────────────────────────────────────────

export const patentsRelations = relations(patents, ({ many }) => ({
  sections: many(patentSections),
  claims: many(patentClaims),
  drawings: many(patentDrawings),
  documents: many(patentDocuments),
  referenceNumerals: many(referenceNumerals),
  priorArtSearches: many(priorArtSearches),
  priorArtSearchMatrices: many(priorArtSearchMatrices),
  versions: many(patentVersions),
  aiGenerations: many(aiGenerations),
}));

export const patentSectionsRelations = relations(patentSections, ({ one }) => ({
  patent: one(patents, {
    fields: [patentSections.patentId],
    references: [patents.id],
  }),
}));

export const patentClaimsRelations = relations(patentClaims, ({ one }) => ({
  patent: one(patents, {
    fields: [patentClaims.patentId],
    references: [patents.id],
  }),
  parentClaim: one(patentClaims, {
    fields: [patentClaims.parentClaimId],
    references: [patentClaims.id],
  }),
}));

export const patentDocumentsRelations = relations(patentDocuments, ({ one }) => ({
  patent: one(patents, {
    fields: [patentDocuments.patentId],
    references: [patents.id],
  }),
}));

export const patentDrawingsRelations = relations(patentDrawings, ({ one }) => ({
  patent: one(patents, {
    fields: [patentDrawings.patentId],
    references: [patents.id],
  }),
}));

export const referenceNumeralsRelations = relations(referenceNumerals, ({ one }) => ({
  patent: one(patents, {
    fields: [referenceNumerals.patentId],
    references: [patents.id],
  }),
  firstFigure: one(patentDrawings, {
    fields: [referenceNumerals.firstFigureId],
    references: [patentDrawings.id],
  }),
}));

export const priorArtSearchMatricesRelations = relations(priorArtSearchMatrices, ({ one }) => ({
  patent: one(patents, {
    fields: [priorArtSearchMatrices.patentId],
    references: [patents.id],
  }),
}));

export const priorArtSearchesRelations = relations(priorArtSearches, ({ one, many }) => ({
  patent: one(patents, {
    fields: [priorArtSearches.patentId],
    references: [patents.id],
  }),
  matrix: one(priorArtSearchMatrices, {
    fields: [priorArtSearches.matrixId],
    references: [priorArtSearchMatrices.id],
  }),
  results: many(priorArtResults),
}));

export const priorArtResultsRelations = relations(priorArtResults, ({ one }) => ({
  search: one(priorArtSearches, {
    fields: [priorArtResults.searchId],
    references: [priorArtSearches.id],
  }),
  patent: one(patents, {
    fields: [priorArtResults.patentId],
    references: [patents.id],
  }),
}));

export const patentVersionsRelations = relations(patentVersions, ({ one }) => ({
  patent: one(patents, {
    fields: [patentVersions.patentId],
    references: [patents.id],
  }),
}));

export const aiGenerationsRelations = relations(aiGenerations, ({ one }) => ({
  patent: one(patents, {
    fields: [aiGenerations.patentId],
    references: [patents.id],
  }),
  section: one(patentSections, {
    fields: [aiGenerations.sectionId],
    references: [patentSections.id],
  }),
}));
