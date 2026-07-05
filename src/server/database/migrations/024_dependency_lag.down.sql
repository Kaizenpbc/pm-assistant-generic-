-- Rollback 024_dependency_lag
ALTER TABLE tasks DROP COLUMN IF EXISTS dependency_lag_days;
