-- Remove legacy columns from meeting_analyses that are unused by MeetingAnalysisRepository
-- These columns were from the original schema but never populated by current code

ALTER TABLE meeting_analyses
  DROP COLUMN IF EXISTS title,
  DROP COLUMN IF EXISTS meeting_date,
  DROP COLUMN IF EXISTS analysis_result,
  DROP COLUMN IF EXISTS ai_powered,
  DROP COLUMN IF EXISTS created_by;
