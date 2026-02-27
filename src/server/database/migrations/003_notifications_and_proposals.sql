-- 003_notifications_and_proposals.sql
-- Persistent notifications table for agentic auto-reschedule and future features

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'info',
  severity ENUM('critical','high','medium','low') NOT NULL DEFAULT 'medium',
  title VARCHAR(500) NOT NULL,
  message TEXT NOT NULL,
  project_id VARCHAR(36) NULL,
  schedule_id VARCHAR(36) NULL,
  link_type VARCHAR(50) NULL,
  link_id VARCHAR(255) NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notif_user (user_id),
  INDEX idx_notif_user_unread (user_id, is_read),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reschedule_proposals (
  id VARCHAR(36) PRIMARY KEY,
  schedule_id VARCHAR(36) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  proposal_data JSON NOT NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'manual',
  feedback TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_proposal_schedule (schedule_id)
);
