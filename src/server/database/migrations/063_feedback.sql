-- User feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  overall_rating TINYINT NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  schedule_rating TINYINT NULL CHECK (schedule_rating BETWEEN 1 AND 5),
  raid_rating TINYINT NULL CHECK (raid_rating BETWEEN 1 AND 5),
  ai_rating TINYINT NULL CHECK (ai_rating BETWEEN 1 AND 5),
  reporting_rating TINYINT NULL CHECK (reporting_rating BETWEEN 1 AND 5),
  category ENUM('bug', 'feature_request', 'general') NOT NULL DEFAULT 'general',
  comment TEXT NULL,
  status ENUM('new', 'reviewed', 'resolved') NOT NULL DEFAULT 'new',
  admin_notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_feedback_user (user_id),
  INDEX idx_feedback_status (status),
  INDEX idx_feedback_created (created_at DESC)
);
