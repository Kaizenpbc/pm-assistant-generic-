-- Rollback 001_agent_proposals
DROP TABLE IF EXISTS agent_confidence_log;
DROP TABLE IF EXISTS agent_cost_ledger;
DROP TABLE IF EXISTS agent_feedback;
DROP TABLE IF EXISTS agent_proposal_reviews;
DROP TABLE IF EXISTS agent_proposal_actions;
DROP TABLE IF EXISTS agent_proposals;
