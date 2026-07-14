-- 054_project_methodology.sql
-- Add methodology column to projects table
ALTER TABLE projects ADD COLUMN methodology ENUM('waterfall','agile','hybrid') NOT NULL DEFAULT 'waterfall' AFTER project_type;
