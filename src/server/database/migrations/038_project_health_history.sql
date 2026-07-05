CREATE TABLE project_health_history (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  health_score INT NOT NULL,
  risk_level ENUM('low','medium','high','critical') NOT NULL,
  schedule_health INT,
  budget_health INT,
  risk_health INT,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_project_date (project_id, recorded_at)
);
