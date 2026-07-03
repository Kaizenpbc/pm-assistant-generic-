CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id VARCHAR(36) PRIMARY KEY,
  operation VARCHAR(100) NOT NULL,
  payload JSON NOT NULL,
  error_message TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 1,
  max_attempts INT NOT NULL DEFAULT 3,
  status ENUM('pending', 'retrying', 'failed', 'resolved') NOT NULL DEFAULT 'pending',
  next_retry_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME DEFAULT NULL,
  INDEX idx_dlq_status_retry (status, next_retry_at),
  INDEX idx_dlq_created (created_at)
);
