-- Agent Proposals: stores recovery plans, action lists, reasoning, and lifecycle status
CREATE TABLE IF NOT EXISTS agent_proposals (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  schedule_id VARCHAR(36),
  agent_id VARCHAR(255) NOT NULL,
  agent_version VARCHAR(50) NOT NULL,
  status ENUM('pending', 'approved', 'rejected', 'expired', 'executing', 'executed', 'rolled_back', 'failed') NOT NULL DEFAULT 'pending',
  title VARCHAR(500) NOT NULL,
  reasoning TEXT NOT NULL,
  summary TEXT NOT NULL,
  confidence_score DECIMAL(5,2) NOT NULL,
  confidence_factors JSON,
  risk_level ENUM('low', 'medium', 'high', 'critical') NOT NULL,
  data_snapshot_version VARCHAR(64),
  expires_at DATETIME,
  created_by VARCHAR(36) NOT NULL,
  reviewed_by VARCHAR(36),
  reviewed_at DATETIME,
  executed_at DATETIME,
  rolled_back_at DATETIME,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_project_status (project_id, status),
  INDEX idx_agent_status (agent_id, status),
  INDEX idx_expires (expires_at),
  INDEX idx_created_by (created_by)
);

-- Agent Proposal Actions: individual steps within a proposal
CREATE TABLE IF NOT EXISTS agent_proposal_actions (
  id VARCHAR(36) PRIMARY KEY,
  proposal_id VARCHAR(36) NOT NULL,
  execution_order INT NOT NULL,
  action_type ENUM('update_task_dates', 'reassign_resource', 'update_dependency', 'update_progress', 'create_change_request', 'update_budget', 'send_notification') NOT NULL,
  target_entity_type VARCHAR(50) NOT NULL,
  target_entity_id VARCHAR(36) NOT NULL,
  old_value JSON,
  new_value JSON,
  reasoning TEXT,
  status ENUM('pending', 'executed', 'rolled_back', 'failed', 'skipped') NOT NULL DEFAULT 'pending',
  executed_at DATETIME,
  error_message TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (proposal_id) REFERENCES agent_proposals(id) ON DELETE CASCADE,
  INDEX idx_proposal_order (proposal_id, execution_order)
);

-- Agent Proposal Reviews: approval/rejection history
CREATE TABLE IF NOT EXISTS agent_proposal_reviews (
  id VARCHAR(36) PRIMARY KEY,
  proposal_id VARCHAR(36) NOT NULL,
  reviewer_id VARCHAR(36) NOT NULL,
  decision ENUM('approved', 'rejected', 'requested_changes') NOT NULL,
  comment TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (proposal_id) REFERENCES agent_proposals(id) ON DELETE CASCADE,
  INDEX idx_proposal (proposal_id)
);

-- Agent Feedback: tracks whether executed proposals actually helped
CREATE TABLE IF NOT EXISTS agent_feedback (
  id VARCHAR(36) PRIMARY KEY,
  proposal_id VARCHAR(36) NOT NULL,
  submitted_by VARCHAR(36) NOT NULL,
  outcome ENUM('effective', 'partially_effective', 'ineffective', 'made_worse', 'rolled_back') NOT NULL,
  comment TEXT,
  metrics_before JSON,
  metrics_after JSON,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (proposal_id) REFERENCES agent_proposals(id) ON DELETE CASCADE,
  UNIQUE KEY idx_proposal_unique (proposal_id)
);

-- Agent Cost Ledger: tracks Claude API token usage per invocation
CREATE TABLE IF NOT EXISTS agent_cost_ledger (
  id VARCHAR(36) PRIMARY KEY,
  agent_id VARCHAR(255) NOT NULL,
  project_id VARCHAR(36),
  scan_id VARCHAR(36),
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  total_tokens INT NOT NULL DEFAULT 0,
  estimated_cost_usd DECIMAL(10,6) NOT NULL DEFAULT 0,
  model VARCHAR(100),
  latency_ms INT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_agent_date (agent_id, created_at),
  INDEX idx_project_date (project_id, created_at),
  INDEX idx_scan (scan_id)
);

-- Agent Confidence Log: stores confidence scores and factors for trend analysis
CREATE TABLE IF NOT EXISTS agent_confidence_log (
  id VARCHAR(36) PRIMARY KEY,
  proposal_id VARCHAR(36),
  agent_id VARCHAR(255) NOT NULL,
  project_id VARCHAR(36) NOT NULL,
  confidence_score DECIMAL(5,2) NOT NULL,
  data_quality_score DECIMAL(5,2),
  historical_accuracy_score DECIMAL(5,2),
  model_certainty_score DECIMAL(5,2),
  factors JSON,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_agent_project (agent_id, project_id),
  INDEX idx_proposal (proposal_id)
);
