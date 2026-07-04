-- Rollback 028_task_sort_order
DROP INDEX idx_tasks_schedule_sort ON tasks;
ALTER TABLE tasks DROP COLUMN IF EXISTS sort_order;
