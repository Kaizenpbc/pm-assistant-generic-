-- Add missing indexes for frequently queried foreign key columns
-- Identified in codebase audit 2026-07-10

-- task_dependencies: queries by dependency_id for "find tasks depending on X"
CREATE INDEX IF NOT EXISTS idx_task_deps_dependency_id ON task_dependencies(dependency_id);

-- lessons_learned: filtered by project_id in extraction and search
CREATE INDEX IF NOT EXISTS idx_lessons_project_id ON lessons_learned(project_id);

-- meeting_analyses: filtered by project_id and schedule_id
CREATE INDEX IF NOT EXISTS idx_meetings_project_id ON meeting_analyses(project_id);

-- embeddings: filtered by document_type + document_id for lookups
CREATE INDEX IF NOT EXISTS idx_embeddings_document ON embeddings(document_type, document_id);
