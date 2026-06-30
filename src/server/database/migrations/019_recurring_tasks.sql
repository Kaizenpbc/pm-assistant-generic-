-- 019: Add recurring task support
ALTER TABLE tasks ADD COLUMN recurrence_rule VARCHAR(255) DEFAULT NULL;
ALTER TABLE tasks ADD COLUMN recurrence_parent_id VARCHAR(36) DEFAULT NULL;
ALTER TABLE tasks ADD COLUMN is_recurrence_template TINYINT(1) DEFAULT 0;

CREATE INDEX idx_tasks_recurrence_parent ON tasks (recurrence_parent_id);
CREATE INDEX idx_tasks_recurrence_template ON tasks (is_recurrence_template);
