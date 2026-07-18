-- Migration 068: Invite tokens table + viewer_limit on organizations

CREATE TABLE IF NOT EXISTS invite_tokens (
  id VARCHAR(36) PRIMARY KEY,
  token VARCHAR(64) NOT NULL UNIQUE,
  inviter_user_id VARCHAR(36) NOT NULL,
  organization_id VARCHAR(36) NOT NULL,
  project_id VARCHAR(36) NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'viewer',
  status ENUM('pending','accepted','expired','revoked') NOT NULL DEFAULT 'pending',
  expires_at DATETIME NOT NULL,
  accepted_at DATETIME NULL,
  accepted_by_user_id VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_invite_token (token),
  INDEX idx_invite_email (email),
  INDEX idx_invite_org (organization_id),
  INDEX idx_invite_status (status, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE organizations ADD COLUMN viewer_limit INT NOT NULL DEFAULT 5 AFTER max_users;
