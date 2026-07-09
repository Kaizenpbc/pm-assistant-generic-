-- Align meeting_analyses table with MeetingAnalysisRepository schema
-- The original table had a different structure; add missing columns

ALTER TABLE meeting_analyses
  ADD COLUMN schedule_id VARCHAR(36) NULL AFTER project_id,
  ADD COLUMN summary MEDIUMTEXT NULL AFTER transcript,
  ADD COLUMN action_items MEDIUMTEXT NULL AFTER summary,
  ADD COLUMN decisions MEDIUMTEXT NULL AFTER action_items,
  ADD COLUMN risks MEDIUMTEXT NULL AFTER decisions,
  ADD COLUMN task_updates MEDIUMTEXT NULL AFTER risks,
  ADD COLUMN applied_items MEDIUMTEXT NULL AFTER task_updates;

-- Make legacy columns nullable (repository INSERT doesn't include them)
ALTER TABLE meeting_analyses
  MODIFY COLUMN title VARCHAR(255) NULL DEFAULT NULL;
