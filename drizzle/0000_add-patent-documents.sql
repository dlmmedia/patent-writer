CREATE TYPE "public"."claim_type" AS ENUM('method', 'system', 'apparatus', 'composition', 'computer_readable_medium', 'means_plus_function');--> statement-breakpoint
CREATE TYPE "public"."entity_size" AS ENUM('micro', 'small', 'large');--> statement-breakpoint
CREATE TYPE "public"."jurisdiction" AS ENUM('US', 'EP', 'JP', 'CN', 'PCT', 'KR', 'AU', 'CA', 'GB');--> statement-breakpoint
CREATE TYPE "public"."patent_status" AS ENUM('draft', 'in_progress', 'review', 'ready_to_file', 'filed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."patent_type" AS ENUM('utility', 'design', 'provisional', 'pct');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."section_type" AS ENUM('title', 'cross_reference', 'field_of_invention', 'background', 'summary', 'brief_description_drawings', 'detailed_description', 'claims', 'abstract');--> statement-breakpoint
CREATE TABLE "ai_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patent_id" uuid,
	"section_id" uuid,
	"model" text NOT NULL,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"cost_usd" real,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patent_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patent_id" uuid NOT NULL,
	"claim_number" integer NOT NULL,
	"claim_type" "claim_type" DEFAULT 'method' NOT NULL,
	"parent_claim_id" uuid,
	"transitional_phrase" varchar(50) DEFAULT 'comprising',
	"preamble" text,
	"body" text,
	"full_text" text NOT NULL,
	"is_independent" boolean DEFAULT true NOT NULL,
	"novelty_score" real,
	"breadth_score" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patent_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patent_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"extracted_text" text,
	"summary" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patent_drawings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patent_id" uuid NOT NULL,
	"figure_number" varchar(10) NOT NULL,
	"figure_label" text NOT NULL,
	"description" text,
	"original_url" text,
	"processed_url" text,
	"thumbnail_url" text,
	"annotations" jsonb,
	"generation_prompt" text,
	"generation_model" text,
	"width" integer,
	"height" integer,
	"dpi" integer DEFAULT 300,
	"is_compliant" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patent_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patent_id" uuid NOT NULL,
	"section_type" "section_type" NOT NULL,
	"title" text NOT NULL,
	"content" jsonb,
	"plain_text" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"generation_model" text,
	"is_ai_generated" boolean DEFAULT false,
	"word_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patent_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patent_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"change_summary" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text DEFAULT 'Untitled Patent' NOT NULL,
	"type" "patent_type" DEFAULT 'utility' NOT NULL,
	"status" "patent_status" DEFAULT 'draft' NOT NULL,
	"jurisdiction" "jurisdiction" DEFAULT 'US' NOT NULL,
	"cpc_codes" jsonb DEFAULT '[]'::jsonb,
	"invention_description" text,
	"entity_size" "entity_size" DEFAULT 'small',
	"ai_model_config" jsonb DEFAULT '{"draftingModel":"gemini-3.1-pro","claimsModel":"gemini-3.1-pro","analysisModel":"gemini-3.1-pro","imageModel":"nano-banana-2"}'::jsonb,
	"technology_area" text,
	"inventors" jsonb DEFAULT '[]'::jsonb,
	"assignee" text,
	"priority_date" timestamp,
	"filing_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prior_art_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"search_id" uuid NOT NULL,
	"patent_id" uuid NOT NULL,
	"external_patent_number" text,
	"title" text NOT NULL,
	"abstract" text,
	"assignee" text,
	"filing_date" text,
	"relevance_score" real,
	"risk_level" "risk_level" DEFAULT 'low',
	"ai_analysis" text,
	"source_api" text NOT NULL,
	"external_url" text,
	"added_to_ids" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prior_art_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patent_id" uuid NOT NULL,
	"query" text NOT NULL,
	"api_sources" jsonb DEFAULT '[]'::jsonb,
	"result_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reference_numerals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patent_id" uuid NOT NULL,
	"numeral" integer NOT NULL,
	"element_name" text NOT NULL,
	"first_figure_id" uuid,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"jurisdiction" "jurisdiction" DEFAULT 'US',
	"patent_type" "patent_type" DEFAULT 'utility',
	"technology_area" text,
	"section_templates" jsonb,
	"claim_templates" jsonb,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_patent_id_patents_id_fk" FOREIGN KEY ("patent_id") REFERENCES "public"."patents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_section_id_patent_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."patent_sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patent_claims" ADD CONSTRAINT "patent_claims_patent_id_patents_id_fk" FOREIGN KEY ("patent_id") REFERENCES "public"."patents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patent_documents" ADD CONSTRAINT "patent_documents_patent_id_patents_id_fk" FOREIGN KEY ("patent_id") REFERENCES "public"."patents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patent_drawings" ADD CONSTRAINT "patent_drawings_patent_id_patents_id_fk" FOREIGN KEY ("patent_id") REFERENCES "public"."patents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patent_sections" ADD CONSTRAINT "patent_sections_patent_id_patents_id_fk" FOREIGN KEY ("patent_id") REFERENCES "public"."patents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patent_versions" ADD CONSTRAINT "patent_versions_patent_id_patents_id_fk" FOREIGN KEY ("patent_id") REFERENCES "public"."patents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prior_art_results" ADD CONSTRAINT "prior_art_results_search_id_prior_art_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."prior_art_searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prior_art_results" ADD CONSTRAINT "prior_art_results_patent_id_patents_id_fk" FOREIGN KEY ("patent_id") REFERENCES "public"."patents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prior_art_searches" ADD CONSTRAINT "prior_art_searches_patent_id_patents_id_fk" FOREIGN KEY ("patent_id") REFERENCES "public"."patents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_numerals" ADD CONSTRAINT "reference_numerals_patent_id_patents_id_fk" FOREIGN KEY ("patent_id") REFERENCES "public"."patents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_numerals" ADD CONSTRAINT "reference_numerals_first_figure_id_patent_drawings_id_fk" FOREIGN KEY ("first_figure_id") REFERENCES "public"."patent_drawings"("id") ON DELETE no action ON UPDATE no action;