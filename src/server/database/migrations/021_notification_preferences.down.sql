-- Rollback 021_notification_preferences
ALTER TABLE users
  DROP COLUMN IF EXISTS email_notifications_enabled,
  DROP COLUMN IF EXISTS digest_frequency,
  DROP COLUMN IF EXISTS digest_last_sent_at;
