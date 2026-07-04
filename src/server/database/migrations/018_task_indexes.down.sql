-- Rollback 018_task_indexes
DROP INDEX idx_tasks_schedule_id ON tasks;
DROP INDEX idx_tasks_status ON tasks;
DROP INDEX idx_tasks_assigned_to ON tasks;
DROP INDEX idx_schedules_project_id ON schedules;
DROP INDEX idx_sprints_project_id ON sprints;
DROP INDEX idx_sprint_tasks_sprint_id ON sprint_tasks;
DROP INDEX idx_agent_proposals_project_id ON agent_proposals;
DROP INDEX idx_agent_proposals_status ON agent_proposals;
