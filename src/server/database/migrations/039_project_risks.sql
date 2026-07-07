-- Migration 039: Project Risks & Issues (RAID log)
-- Single source of truth for risks and issues — manual, AI-detected, and agent-created.

CREATE TABLE IF NOT EXISTS project_risks (
  id            CHAR(36) PRIMARY KEY,
  project_id    CHAR(36) NOT NULL,
  type          ENUM('risk','issue') NOT NULL DEFAULT 'risk',
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  category      ENUM('schedule','budget','resource','technical','regulatory','stakeholder','weather','dependency','other') NOT NULL DEFAULT 'other',
  severity      ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  probability   TINYINT UNSIGNED NOT NULL DEFAULT 3 CHECK (probability BETWEEN 1 AND 5),
  impact        TINYINT UNSIGNED NOT NULL DEFAULT 3 CHECK (impact BETWEEN 1 AND 5),
  risk_score    TINYINT UNSIGNED GENERATED ALWAYS AS (probability * impact) STORED,
  status        ENUM('open','monitoring','mitigating','mitigated','closed','resolved') NOT NULL DEFAULT 'open',
  trigger_condition TEXT,
  triggered     BOOLEAN NOT NULL DEFAULT FALSE,
  triggered_at  TIMESTAMP NULL,
  mitigation_plan TEXT,
  response_plan TEXT,
  owner_id      CHAR(36),
  source        ENUM('manual','ai_detected','agent') NOT NULL DEFAULT 'manual',
  source_agent_id VARCHAR(64),
  ai_confidence DECIMAL(3,2),
  linked_task_ids JSON,
  linked_proposal_id CHAR(36),
  created_by    CHAR(36) NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at   TIMESTAMP NULL,

  INDEX idx_project_risks_project_type_status (project_id, type, status),
  INDEX idx_project_risks_project_triggered (project_id, triggered),
  INDEX idx_project_risks_agent_source (source_agent_id, project_id)
);
