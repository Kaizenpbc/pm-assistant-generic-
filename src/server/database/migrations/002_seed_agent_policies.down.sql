-- Rollback 002_seed_agent_policies
DELETE FROM policies WHERE id IN (
  'policy-agent-low-risk-auto',
  'policy-agent-medium-risk-approval',
  'policy-agent-high-risk-approval',
  'policy-agent-critical-risk-block',
  'policy-agent-low-confidence-block',
  'policy-agent-cost-circuit-breaker'
);
