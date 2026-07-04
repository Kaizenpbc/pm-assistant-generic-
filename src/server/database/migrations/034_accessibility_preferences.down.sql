-- Rollback 034_accessibility_preferences
ALTER TABLE users DROP COLUMN IF EXISTS accessibility_preferences;
