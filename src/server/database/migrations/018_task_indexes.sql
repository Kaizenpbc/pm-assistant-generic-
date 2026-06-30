-- Add indexes on commonly queried task columns
CREATE INDEX IF NOT EXISTS idx_tasks_schedule_id ON tasks (schedule_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks (assigned_to);

-- Sprint query performance
CREATE INDEX IF NOT EXISTS idx_sprints_project_id ON sprints (project_id);
CREATE INDEX IF NOT EXISTS idx_sprint_tasks_sprint_id ON sprint_tasks (sprint_id);

-- Agent proposals query performance
CREATE INDEX IF NOT EXISTS idx_agent_proposals_project_id ON agent_proposals (project_id);
CREATE INDEX IF NOT EXISTS idx_agent_proposals_status ON agent_proposals (status);
