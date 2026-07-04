-- Rollback 030_ai_usage_log
DROP TABLE IF EXISTS ai_usage_log;
ALTER TABLE users DROP COLUMN IF EXISTS ai_monthly_token_budget;
