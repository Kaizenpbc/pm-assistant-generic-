-- Webhook delivery log for audit trail and retry tracking
CREATE TABLE webhook_deliveries (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  webhook_id VARCHAR(36) NOT NULL,
  event VARCHAR(100) NOT NULL,
  payload JSON,
  status_code INT NULL,
  response_time_ms INT NULL,
  error TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_deliveries_webhook (webhook_id),
  INDEX idx_deliveries_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
