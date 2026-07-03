-- AI Usage Logging + Per-User Token Budget
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NULL,
  feature VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  cost_estimate DECIMAL(10, 6) NOT NULL DEFAULT 0,
  latency_ms INT NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  error_message TEXT NULL,
  request_context JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ai_usage_user_created (user_id, created_at),
  INDEX idx_ai_usage_feature (feature),
  INDEX idx_ai_usage_created (created_at)
);

ALTER TABLE users ADD COLUMN ai_monthly_token_budget INT DEFAULT NULL;
