-- Add sort_order column to tasks for user-controlled ordering
ALTER TABLE tasks ADD COLUMN sort_order INT NOT NULL DEFAULT 0;

-- Backfill existing tasks: assign sort_order based on created_at within each schedule
SET @row_num := 0;
SET @prev_schedule := '';

UPDATE tasks t
JOIN (
  SELECT id,
    @row_num := IF(@prev_schedule = schedule_id, @row_num + 1, 0) AS rn,
    @prev_schedule := schedule_id AS sid
  FROM tasks
  ORDER BY schedule_id, created_at
) ranked ON t.id = ranked.id
SET t.sort_order = ranked.rn;

-- Index for efficient ordering
CREATE INDEX idx_tasks_schedule_sort ON tasks (schedule_id, sort_order);
