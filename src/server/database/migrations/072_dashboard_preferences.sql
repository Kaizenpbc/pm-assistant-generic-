-- Dashboard widget preferences (order, visibility, scope) — persisted per user
ALTER TABLE users ADD COLUMN dashboard_preferences JSON DEFAULT NULL;
