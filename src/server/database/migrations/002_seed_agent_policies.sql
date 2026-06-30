-- Seed default agent policies from AGENT_STRATEGY.md

-- Low risk: read-only agents auto-allowed
INSERT IGNORE INTO policies (id, project_id, name, description, action_pattern, condition_expr, enforcement, is_active, created_by, created_at)
VALUES (
  'policy-agent-low-risk-auto',
  NULL,
  'Agent Low Risk Auto-Allow',
  'Allow read-only agent actions (portfolio analysis, pattern detection) with log-only enforcement',
  'agent.invoke.portfolio.*',
  '{"field": "confidence_score", "op": ">=", "value": 60}',
  'log_only',
  1,
  'system',
  NOW()
);

-- Medium risk: schedule modifications require approval
INSERT IGNORE INTO policies (id, project_id, name, description, action_pattern, condition_expr, enforcement, is_active, created_by, created_at)
VALUES (
  'policy-agent-medium-risk-approval',
  NULL,
  'Agent Schedule Actions Require Approval',
  'Schedule recovery and optimization actions require human approval',
  'agent.invoke.schedule.*',
  '{"field": "confidence_score", "op": ">=", "value": 40}',
  'require_approval',
  1,
  'system',
  NOW()
);

-- High risk: resource changes require approval
INSERT IGNORE INTO policies (id, project_id, name, description, action_pattern, condition_expr, enforcement, is_active, created_by, created_at)
VALUES (
  'policy-agent-high-risk-approval',
  NULL,
  'Agent Resource Actions Require Approval',
  'Resource optimization and reassignment actions require human approval',
  'agent.invoke.resource.*',
  '{"field": "confidence_score", "op": ">=", "value": 40}',
  'require_approval',
  1,
  'system',
  NOW()
);

-- Critical risk: budget actions blocked by default
INSERT IGNORE INTO policies (id, project_id, name, description, action_pattern, condition_expr, enforcement, is_active, created_by, created_at)
VALUES (
  'policy-agent-critical-risk-block',
  NULL,
  'Agent Budget Actions Blocked',
  'Budget modification actions are blocked by default. Must be explicitly enabled per project.',
  'agent.invoke.budget.*',
  '{"field": "always", "op": "==", "value": true}',
  'block',
  1,
  'system',
  NOW()
);

-- Universal: block any agent action with very low confidence
INSERT IGNORE INTO policies (id, project_id, name, description, action_pattern, condition_expr, enforcement, is_active, created_by, created_at)
VALUES (
  'policy-agent-low-confidence-block',
  NULL,
  'Block Low Confidence Agent Actions',
  'Block all agent actions when confidence score is below 40%',
  'agent.invoke.*',
  '{"field": "confidence_score", "op": "<", "value": 40}',
  'block',
  1,
  'system',
  NOW()
);

-- Cost circuit breaker: block when daily cost exceeds limit
INSERT IGNORE INTO policies (id, project_id, name, description, action_pattern, condition_expr, enforcement, is_active, created_by, created_at)
VALUES (
  'policy-agent-cost-circuit-breaker',
  NULL,
  'Agent Cost Circuit Breaker',
  'Block all agent actions when daily Claude API cost exceeds $10 USD',
  'agent.invoke.*',
  '{"field": "daily_cost_usd", "op": ">", "value": 10}',
  'block',
  1,
  'system',
  NOW()
);
