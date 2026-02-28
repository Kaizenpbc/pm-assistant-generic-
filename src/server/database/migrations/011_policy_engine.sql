-- 011_policy_engine.sql
-- Policy engine tables for pre-action gates

CREATE TABLE IF NOT EXISTS policies (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) DEFAULT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  action_pattern VARCHAR(100) NOT NULL,
  condition_expr JSON NOT NULL,
  enforcement ENUM('log_only','require_approval','block') NOT NULL DEFAULT 'log_only',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_project (project_id, is_active)
);

CREATE TABLE IF NOT EXISTS policy_evaluations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  policy_id VARCHAR(36) NOT NULL,
  action VARCHAR(100) NOT NULL,
  actor_id VARCHAR(36) NOT NULL,
  entity_type VARCHAR(50) DEFAULT NULL,
  entity_id VARCHAR(36) DEFAULT NULL,
  matched TINYINT(1) NOT NULL,
  enforcement_result ENUM('allowed','blocked','pending_approval') NOT NULL,
  context_snapshot JSON,
  created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
  FOREIGN KEY (policy_id) REFERENCES policies(id)
);
