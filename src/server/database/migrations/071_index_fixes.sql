-- 071: Fix missing and suboptimal indexes
-- 1. Missing index on integration_sync_log(integration_id) — full table scan on sync log queries
CREATE INDEX idx_sync_log_integration ON integration_sync_log(integration_id);

-- 2. Reversed index on project_risks — current (source_agent_id, project_id) doesn't match
--    query pattern WHERE project_id = ? AND source_agent_id = ?
DROP INDEX idx_project_risks_agent_source ON project_risks;
CREATE INDEX idx_project_risks_project_agent ON project_risks(project_id, source_agent_id);

-- 3. Missing composite index on goals(parent_id, goal_type) for progress queries
CREATE INDEX idx_goals_parent_type ON goals(parent_id, goal_type);
