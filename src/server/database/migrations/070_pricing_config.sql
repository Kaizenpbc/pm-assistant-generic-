-- Centralized pricing configuration
CREATE TABLE IF NOT EXISTS pricing_config (
  id VARCHAR(36) PRIMARY KEY,
  tier VARCHAR(20) NOT NULL UNIQUE,
  display_name VARCHAR(50) NOT NULL,
  monthly_price_cents INT NOT NULL DEFAULT 0,
  annual_price_cents INT NOT NULL DEFAULT 0,
  ai_tokens_monthly INT NOT NULL DEFAULT 0,
  ai_tokens_label VARCHAR(50) NOT NULL DEFAULT '0',
  ai_tokens_description VARCHAR(200) DEFAULT NULL,
  storage_mb INT NOT NULL DEFAULT 100,
  storage_label VARCHAR(20) NOT NULL DEFAULT '100MB',
  viewer_limit INT NOT NULL DEFAULT 0,
  viewer_limit_label VARCHAR(20) NOT NULL DEFAULT '0',
  max_projects INT NOT NULL DEFAULT 0,
  is_per_seat TINYINT NOT NULL DEFAULT 0,
  min_seats INT NOT NULL DEFAULT 1,
  duration_days INT NOT NULL DEFAULT 0,
  highlight TINYINT NOT NULL DEFAULT 0,
  stripe_monthly_price_id VARCHAR(255) DEFAULT NULL,
  stripe_annual_price_id VARCHAR(255) DEFAULT NULL,
  features_json JSON NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Feature gating per tier
CREATE TABLE IF NOT EXISTS tier_features (
  id VARCHAR(36) PRIMARY KEY,
  tier VARCHAR(20) NOT NULL,
  feature_key VARCHAR(50) NOT NULL,
  enabled TINYINT NOT NULL DEFAULT 1,
  UNIQUE KEY uq_tier_feature (tier, feature_key)
);

-- Seed pricing_config
INSERT INTO pricing_config (id, tier, display_name, monthly_price_cents, annual_price_cents,
  ai_tokens_monthly, ai_tokens_label, ai_tokens_description, storage_mb, storage_label,
  viewer_limit, viewer_limit_label, max_projects, is_per_seat, min_seats, duration_days,
  highlight, features_json, sort_order)
VALUES
  (UUID(), 'trial', 'Free Trial', 0, 0,
   25000, '25K', 'Enough to explore all AI features', 100, '100MB',
   0, '0', 3, 0, 1, 14,
   0, '["Up to 3 projects","14-day full access","Mjuzi AI assistant (25K tokens)","Gantt, Kanban, Sprint boards","RAID management","No credit card required"]', 0),

  (UUID(), 'consultant', 'Consultant', 1900, 19000,
   500000, '500K', '~100 AI chats, 50 risk scans, or 25 reports/mo', 1024, '1GB',
   5, '5', 0, 0, 1, 0,
   0, '["Unlimited projects","All PM features included","Mjuzi AI assistant (500K tokens/mo)","Gantt, Kanban, Sprint boards","RAID management & risk scans","All exports (CSV, PDF, XML)","API access & integrations","5 free viewer invites for clients"]', 1),

  (UUID(), 'sme', 'SME', 3300, 33000,
   500000, '500K/seat', '500K AI tokens per seat, pooled across your team', 5120, '5GB',
   999999, 'Unlimited', 0, 1, 3, 0,
   1, '["Everything in Consultant, plus:","500K AI tokens per seat (pooled)","5GB file storage","Unlimited viewer invites","EVM dashboard & Monte Carlo","Resource management & heatmaps","Custom report builder","DAG workflow automation"]', 2);

-- Seed tier_features: 12 feature keys x 3 tiers
-- Trial: all disabled
INSERT INTO tier_features (id, tier, feature_key, enabled) VALUES
  (UUID(), 'trial', 'exports', 0),
  (UUID(), 'trial', 'evm', 0),
  (UUID(), 'trial', 'monte_carlo', 0),
  (UUID(), 'trial', 'auto_reschedule', 0),
  (UUID(), 'trial', 'resources', 0),
  (UUID(), 'trial', 'reports', 0),
  (UUID(), 'trial', 'workflows', 0),
  (UUID(), 'trial', 'portal', 0),
  (UUID(), 'trial', 'meeting_intelligence', 0),
  (UUID(), 'trial', 'nl_query', 0),
  (UUID(), 'trial', 'cross_project_intelligence', 0),
  (UUID(), 'trial', 'api_keys', 0);

-- Consultant: all enabled
INSERT INTO tier_features (id, tier, feature_key, enabled) VALUES
  (UUID(), 'consultant', 'exports', 1),
  (UUID(), 'consultant', 'evm', 1),
  (UUID(), 'consultant', 'monte_carlo', 1),
  (UUID(), 'consultant', 'auto_reschedule', 1),
  (UUID(), 'consultant', 'resources', 1),
  (UUID(), 'consultant', 'reports', 1),
  (UUID(), 'consultant', 'workflows', 1),
  (UUID(), 'consultant', 'portal', 1),
  (UUID(), 'consultant', 'meeting_intelligence', 1),
  (UUID(), 'consultant', 'nl_query', 1),
  (UUID(), 'consultant', 'cross_project_intelligence', 1),
  (UUID(), 'consultant', 'api_keys', 1);

-- SME: all enabled
INSERT INTO tier_features (id, tier, feature_key, enabled) VALUES
  (UUID(), 'sme', 'exports', 1),
  (UUID(), 'sme', 'evm', 1),
  (UUID(), 'sme', 'monte_carlo', 1),
  (UUID(), 'sme', 'auto_reschedule', 1),
  (UUID(), 'sme', 'resources', 1),
  (UUID(), 'sme', 'reports', 1),
  (UUID(), 'sme', 'workflows', 1),
  (UUID(), 'sme', 'portal', 1),
  (UUID(), 'sme', 'meeting_intelligence', 1),
  (UUID(), 'sme', 'nl_query', 1),
  (UUID(), 'sme', 'cross_project_intelligence', 1),
  (UUID(), 'sme', 'api_keys', 1);
