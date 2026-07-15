-- Webhook delivery log for audit trail and retry tracking
CREATE TABLE webhook_deliveries (
  id CHAR(36) PRIMARY KEY,
  webhook_id CHAR(36) NOT NULL,
  event VARCHAR(100) NOT NULL,
  payload JSON,
  status_code INT NULL,
  response_time_ms INT NULL,
  error TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_deliveries_webhook (webhook_id),
  INDEX idx_deliveries_created (created_at),
  CONSTRAINT fk_deliveries_webhook FOREIGN KEY (webhook_id)
    REFERENCES webhooks(id) ON DELETE CASCADE
);
