-- Rollback 026_user_timezone
ALTER TABLE users DROP COLUMN IF EXISTS timezone;
