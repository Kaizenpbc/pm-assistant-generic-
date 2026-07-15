-- Project archiving support
ALTER TABLE projects ADD COLUMN archived_at TIMESTAMP NULL DEFAULT NULL;
CREATE INDEX idx_projects_archived_at ON projects (archived_at);
