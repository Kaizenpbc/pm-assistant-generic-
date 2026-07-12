-- Migration 052: Add missing performance indexes identified in code audit
-- These indexes address N+1 query patterns and full table scans

-- Index for recurrence service queries filtering by recurrence_parent_id
CREATE INDEX IF NOT EXISTS idx_tasks_recurrence_parent
  ON tasks(recurrence_parent_id);

-- Index for autonomy service queries filtering by disabled_at
CREATE INDEX IF NOT EXISTS idx_autonomy_active
  ON agent_autonomy_config(agent_id, disabled_at);

-- Index for workflow engine querying enabled definitions on every task change
CREATE INDEX IF NOT EXISTS idx_workflow_enabled
  ON workflow_definitions(is_enabled);
