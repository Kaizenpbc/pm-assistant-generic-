-- Add lag days for dependency scheduling
ALTER TABLE tasks ADD COLUMN dependency_lag_days INT NOT NULL DEFAULT 0;
