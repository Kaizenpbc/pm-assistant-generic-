-- Add per-category notification type preferences (JSON column)
ALTER TABLE users ADD COLUMN notification_type_preferences JSON DEFAULT NULL;
