-- Migration 033: Agent memory layer
-- Persistent memory for agents across sessions

CREATE TABLE IF NOT EXISTS agent_memory (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  agent_id VARCHAR(100) NOT NULL,
  memory_type ENUM('session', 'project', 'role', 'reflection') NOT NULL,
  entity_id VARCHAR(36) DEFAULT NULL,
  key_name VARCHAR(255) NOT NULL,
  value JSON NOT NULL,
  expires_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_memory_lookup (agent_id, memory_type, entity_id, key_name),
  INDEX idx_memory_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
