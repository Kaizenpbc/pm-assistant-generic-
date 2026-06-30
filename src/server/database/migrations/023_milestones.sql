-- Add milestone flag to tasks
ALTER TABLE tasks ADD COLUMN is_milestone BOOLEAN NOT NULL DEFAULT FALSE;
