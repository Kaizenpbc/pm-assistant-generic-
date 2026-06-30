ALTER TABLE users
  ADD COLUMN email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN digest_frequency ENUM('none','daily','weekly') NOT NULL DEFAULT 'none',
  ADD COLUMN digest_last_sent_at DATETIME NULL;
