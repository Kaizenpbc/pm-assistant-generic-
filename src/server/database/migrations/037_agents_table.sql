-- Migration 037: First-class agents table
-- Central registry of all agents with identity, role, status, and configuration

CREATE TABLE agents (
  id VARCHAR(100) NOT NULL PRIMARY KEY,
  display_name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  agent_role ENUM(
    'admin', 'executive', 'project_manager', 'team_member', 'scrum_master', 'finance_officer',
    'risk_manager', 'pmo', 'ba', 'qa', 'tester', 'devops', 'claude_sme'
  ) NOT NULL DEFAULT 'project_manager',
  capability VARCHAR(100) NOT NULL,
  version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  permissions JSON DEFAULT NULL,
  config JSON DEFAULT NULL,
  timeout_ms INT NOT NULL DEFAULT 60000,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_agents_enabled (is_enabled),
  INDEX idx_agents_role (agent_role)
);

-- Seed all 16 existing agents
INSERT INTO agents (id, display_name, description, agent_role, capability, version, permissions, timeout_ms) VALUES
  ('auto-reschedule-v1', 'Auto-Reschedule Agent', 'Detects schedule delays and generates reschedule proposals', 'project_manager', 'schedule.optimize', '1.0.0', '["agent:schedule"]', 120000),
  ('budget-forecast-v1', 'Budget Forecast Agent', 'Generates budget forecasts using earned value management', 'finance_officer', 'budget.forecast', '1.0.0', '["agent:budget"]', 60000),
  ('monte-carlo-v1', 'Monte Carlo Agent', 'Runs Monte Carlo simulations for schedule risk analysis', 'risk_manager', 'schedule.simulate', '1.0.0', '["agent:schedule"]', 60000),
  ('meeting-followup-v1', 'Meeting Follow-up Agent', 'Extracts action items and tasks from meeting transcripts', 'ba', 'meeting.extract', '1.0.0', '["agent:meeting"]', 60000),
  ('schedule-recovery-v1', 'Schedule Recovery Agent', 'Analyzes schedule failures and generates recovery plans', 'project_manager', 'schedule.recover', '1.0.0', '["agent:schedule"]', 120000),
  ('scope-creep-detection-v1', 'Scope Creep Detector', 'Detects scope creep by analyzing task additions, expansions, and timeline changes', 'project_manager', 'risk.scope', '1.0.0', '["agent:risk"]', 120000),
  ('budget-intelligence-v1', 'Budget Intelligence Agent', 'Detects budget anomalies, spending patterns, and cost risks', 'finance_officer', 'budget.analyze', '1.0.0', '["agent:budget"]', 120000),
  ('resource-optimization-v1', 'Resource Optimization Agent', 'Analyzes resource allocation and suggests rebalancing', 'project_manager', 'resource.optimize', '1.0.0', '["agent:resource"]', 120000),
  ('cross-project-intelligence-v1', 'Cross-Project Intelligence Agent', 'Analyzes patterns across the entire portfolio for systemic risks and optimization', 'pmo', 'portfolio.analyze', '1.0.0', '["agent:portfolio"]', 120000),
  ('risk-escalation-v1', 'Risk Escalation Agent', 'Aggregates findings from all agents and escalates compound risks', 'risk_manager', 'risk.escalate', '1.0.0', '["agent:risk"]', 120000),
  ('stakeholder-communication-v1', 'Stakeholder Communication Agent', 'Generates stakeholder updates and status communications', 'project_manager', 'communication.generate', '1.0.0', '["agent:communication"]', 120000),
  ('project-hygiene-v1', 'Project Hygiene Agent', 'Checks project data quality, missing fields, stale tasks, and naming conventions', 'qa', 'quality.hygiene', '1.0.0', '["agent:quality"]', 120000),
  ('dependency-risk-v1', 'Dependency Risk Agent', 'Analyzes task dependencies for critical path risks and bottlenecks', 'project_manager', 'risk.dependency', '1.0.0', '["agent:risk"]', 120000),
  ('lessons-learned-v1', 'Lessons Learned Agent', 'Extracts lessons from completed projects and applies to active ones', 'ba', 'knowledge.lessons', '1.0.0', '["agent:knowledge"]', 120000),
  ('predictive-alerting-v1', 'Predictive Alerting Agent', 'Detects patterns that predict project problems using velocity trends and risk accumulation', 'risk_manager', 'prediction.alert', '1.0.0', '["agent:prediction"]', 180000),
  ('rag-query-v1', 'RAG Query Agent', 'Retrieves and synthesizes information from project documents using embeddings', 'claude_sme', 'knowledge.query', '1.0.0', '["agent:knowledge"]', 60000);
