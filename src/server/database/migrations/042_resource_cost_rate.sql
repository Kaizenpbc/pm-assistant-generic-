-- Migration 042: Add cost_rate_hourly to resources
ALTER TABLE resources ADD COLUMN cost_rate_hourly DECIMAL(10,2) DEFAULT NULL;
