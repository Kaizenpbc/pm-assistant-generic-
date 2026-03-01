-- Add index on tasks.end_date for overdue scan queries
-- Used by AgentSchedulerService.runOverdueScan() which runs every 2 minutes:
--   WHERE end_date < CURDATE() AND status NOT IN (...)
CREATE INDEX idx_tasks_end_date ON tasks (end_date);
