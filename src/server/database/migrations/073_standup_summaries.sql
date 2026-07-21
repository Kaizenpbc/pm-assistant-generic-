-- Standup summaries: daily per-project change summaries with optional AI narrative
CREATE TABLE IF NOT EXISTS standup_summaries (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  summary_date DATE NOT NULL,
  changes JSON NOT NULL,
  narrative TEXT DEFAULT NULL,
  generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY idx_standup_project_date (project_id, summary_date),
  INDEX idx_standup_date (summary_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
