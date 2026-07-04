-- Rollback 023_milestones
ALTER TABLE tasks DROP COLUMN IF EXISTS is_milestone;
