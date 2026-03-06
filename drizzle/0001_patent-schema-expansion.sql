-- Phase 1: Patent Schema Expansion
-- Adds bibliographic fields, structured invention disclosure, and AI intake interview support

ALTER TABLE "patents" ADD COLUMN IF NOT EXISTS "docket_number" text;
ALTER TABLE "patents" ADD COLUMN IF NOT EXISTS "application_number" text;
ALTER TABLE "patents" ADD COLUMN IF NOT EXISTS "publication_number" text;
ALTER TABLE "patents" ADD COLUMN IF NOT EXISTS "kind_code" text;
ALTER TABLE "patents" ADD COLUMN IF NOT EXISTS "correspondence_address" jsonb;
ALTER TABLE "patents" ADD COLUMN IF NOT EXISTS "government_contract" jsonb;
ALTER TABLE "patents" ADD COLUMN IF NOT EXISTS "related_applications" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "patents" ADD COLUMN IF NOT EXISTS "invention_problem" text;
ALTER TABLE "patents" ADD COLUMN IF NOT EXISTS "invention_solution" text;
ALTER TABLE "patents" ADD COLUMN IF NOT EXISTS "key_features" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "patents" ADD COLUMN IF NOT EXISTS "known_prior_art" text;
ALTER TABLE "patents" ADD COLUMN IF NOT EXISTS "intake_completed" boolean DEFAULT false;
ALTER TABLE "patents" ADD COLUMN IF NOT EXISTS "intake_responses" jsonb DEFAULT '[]'::jsonb;
