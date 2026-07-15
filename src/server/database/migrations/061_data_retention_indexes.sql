-- Migration 061: Indexes to support data retention cleanup queries

-- notifications: index on (is_read, created_at) for purging read notifications
CREATE INDEX IF NOT EXISTS idx_notifications_read_created
  ON notifications (is_read, created_at);

-- dead_letter_queue: index on (status, created_at) for purging resolved/failed entries
CREATE INDEX IF NOT EXISTS idx_dead_letter_status_created
  ON dead_letter_queue (status, created_at);

-- api_key_usage_log: index on created_at for purging old entries
CREATE INDEX IF NOT EXISTS idx_api_key_usage_created
  ON api_key_usage_log (created_at);

-- webhook_deliveries: index on created_at for purging old entries
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created
  ON webhook_deliveries (created_at);
