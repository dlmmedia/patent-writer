-- Phase 2: Prior Art Search Matrix and Enhanced Search Tracking
-- Adds search matrices table, extends prior art searches with provenance tracking

-- New table for CPC search matrices
CREATE TABLE IF NOT EXISTS "prior_art_search_matrices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "patent_id" uuid NOT NULL REFERENCES "patents"("id") ON DELETE CASCADE,
  "cpc_entries" jsonb DEFAULT '[]'::jsonb,
  "combined_queries" jsonb DEFAULT '[]'::jsonb,
  "search_workflow" jsonb,
  "keyword_groups" jsonb DEFAULT '[]'::jsonb,
  "strongest_terms" jsonb,
  "prior_art_risk_areas" jsonb DEFAULT '[]'::jsonb,
  "generated_by_model" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Extend prior_art_searches with keyword/CPC tracking
ALTER TABLE "prior_art_searches" ADD COLUMN IF NOT EXISTS "keyword_groups_used" jsonb;
ALTER TABLE "prior_art_searches" ADD COLUMN IF NOT EXISTS "cpc_filters" jsonb;
ALTER TABLE "prior_art_searches" ADD COLUMN IF NOT EXISTS "search_strategy" text;
ALTER TABLE "prior_art_searches" ADD COLUMN IF NOT EXISTS "matrix_id" uuid REFERENCES "prior_art_search_matrices"("id") ON DELETE SET NULL;

-- Extend prior_art_results with query provenance
ALTER TABLE "prior_art_results" ADD COLUMN IF NOT EXISTS "matched_query" text;
ALTER TABLE "prior_art_results" ADD COLUMN IF NOT EXISTS "matched_cpc_codes" jsonb;
ALTER TABLE "prior_art_results" ADD COLUMN IF NOT EXISTS "cpc_overlap_score" real;
