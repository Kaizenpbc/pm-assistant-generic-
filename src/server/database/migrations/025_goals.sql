-- Goals / OKR tracking
CREATE TABLE IF NOT EXISTS goals (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  owner_id VARCHAR(36) NOT NULL,
  parent_id VARCHAR(36) NULL,
  goal_type ENUM('objective','key_result') NOT NULL DEFAULT 'objective',
  status ENUM('on_track','at_risk','behind','completed') NOT NULL DEFAULT 'on_track',
  progress DECIMAL(5,2) NOT NULL DEFAULT 0,
  target_value DECIMAL(10,2) NULL,
  current_value DECIMAL(10,2) NULL,
  unit VARCHAR(50) NULL,
  start_date DATE NULL,
  due_date DATE NULL,
  project_id VARCHAR(36) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_owner (owner_id),
  INDEX idx_parent (parent_id),
  INDEX idx_project (project_id),
  INDEX idx_type (goal_type)
);
