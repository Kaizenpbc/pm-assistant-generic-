-- 010_audit_ledger.sql
-- Immutable audit ledger with hash-chain integrity

CREATE TABLE IF NOT EXISTS audit_ledger (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entry_uuid CHAR(36) NOT NULL UNIQUE,
  prev_hash CHAR(64) NOT NULL,
  entry_hash CHAR(64) NOT NULL,
  actor_id VARCHAR(36) NOT NULL,
  actor_type ENUM('user','api_key','system') NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(36) NOT NULL,
  project_id VARCHAR(36) DEFAULT NULL,
  payload JSON NOT NULL,
  source ENUM('web','mcp','api','system') NOT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  session_id VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_project (project_id, created_at),
  INDEX idx_actor (actor_id, created_at),
  INDEX idx_action (action, created_at)
) ENGINE=InnoDB;

-- Prevent UPDATE on audit_ledger (append-only)
DROP TRIGGER IF EXISTS audit_ledger_no_update;
CREATE TRIGGER audit_ledger_no_update BEFORE UPDATE ON audit_ledger
FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_ledger is append-only';

-- Prevent DELETE on audit_ledger (append-only)
DROP TRIGGER IF EXISTS audit_ledger_no_delete;
CREATE TRIGGER audit_ledger_no_delete BEFORE DELETE ON audit_ledger
FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'audit_ledger is append-only';
