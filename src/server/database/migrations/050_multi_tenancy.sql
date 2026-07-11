-- Multi-tenancy: organizations table and user-org link
-- Only effective when MULTI_TENANT_ENABLED=true

CREATE TABLE IF NOT EXISTS organizations (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  db_name VARCHAR(128) NOT NULL UNIQUE,
  owner_user_id CHAR(36) NOT NULL,
  stripe_customer_id VARCHAR(255),
  subscription_tier ENUM('free','pro','business','consultant') DEFAULT 'free',
  subscription_status ENUM('active','trialing','past_due','canceled','incomplete','none') DEFAULT 'none',
  trial_ends_at DATETIME,
  max_users INT DEFAULT 10,
  is_active TINYINT(1) DEFAULT 1,
  is_provisioned TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_org_slug (slug),
  INDEX idx_org_owner (owner_user_id)
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id CHAR(36) NULL AFTER id;
ALTER TABLE users ADD INDEX IF NOT EXISTS idx_user_org (organization_id);
