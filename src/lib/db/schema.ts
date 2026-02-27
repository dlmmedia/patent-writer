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
    draftingModel: "gemini-2.5-flash",
    claimsModel: "gpt-5.2",
    analysisModel: "gemini-2.5-pro",
    imageModel: "imagen-3",
  }),
  technologyArea: text("technology_area"),
  inventors: jsonb("inventors").$type<{ name: string; address?: string }[]>().default([]),
  assignee: text("assignee"),
  priorityDate: timestamp("priority_date"),
  filingDate: timestamp("filing_date"),
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
  width: integer("width"),
  height: integer("height"),
  dpi: integer("dpi").default(300),
  isCompliant: boolean("is_compliant").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
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

export const priorArtSearches = pgTable("prior_art_searches", {
  id: uuid("id").primaryKey().defaultRandom(),
  patentId: uuid("patent_id")
    .notNull()
    .references(() => patents.id, { onDelete: "cascade" }),
  query: text("query").notNull(),
  apiSources: jsonb("api_sources").$type<string[]>().default([]),
  resultCount: integer("result_count").default(0),
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
  referenceNumerals: many(referenceNumerals),
  priorArtSearches: many(priorArtSearches),
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

export const priorArtSearchesRelations = relations(priorArtSearches, ({ one, many }) => ({
  patent: one(patents, {
    fields: [priorArtSearches.patentId],
    references: [patents.id],
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
