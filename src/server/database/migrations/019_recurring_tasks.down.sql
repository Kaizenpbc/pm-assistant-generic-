-- Rollback 019_recurring_tasks
DROP INDEX idx_tasks_recurrence_parent ON tasks;
DROP INDEX idx_tasks_recurrence_template ON tasks;
ALTER TABLE tasks
  DROP COLUMN IF EXISTS recurrence_rule,
  DROP COLUMN IF EXISTS recurrence_parent_id,
  DROP COLUMN IF EXISTS is_recurrence_template;
