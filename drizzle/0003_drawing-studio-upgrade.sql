ALTER TABLE "patent_drawings" ADD COLUMN IF NOT EXISTS "figure_type" varchar(40);
ALTER TABLE "patent_drawings" ADD COLUMN IF NOT EXISTS "sort_order" integer DEFAULT 0;
ALTER TABLE "patent_drawings" ADD COLUMN IF NOT EXISTS "previous_versions" jsonb;
