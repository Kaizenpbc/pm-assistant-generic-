-- Migration 003: Agent Autonomy Configuration (Tier 3)
-- Allows promoting agents to autonomous execution mode

CREATE TABLE IF NOT EXISTS agent_autonomy_config (
  id VARCHAR(36) PRIMARY KEY,
  agent_id VARCHAR(100) NOT NULL,
  project_id VARCHAR(36) DEFAULT NULL,
  autonomy_tier INT NOT NULL DEFAULT 2,
  min_confidence_threshold INT NOT NULL DEFAULT 80,
  max_risk_level VARCHAR(20) NOT NULL DEFAULT 'low',
  enabled_by VARCHAR(36) NOT NULL,
  enabled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  disabled_at TIMESTAMP NULL,
  UNIQUE KEY uq_agent_project (agent_id, project_id)
);
