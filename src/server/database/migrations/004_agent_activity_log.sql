CREATE TABLE IF NOT EXISTS agent_activity_log (
  id          VARCHAR(36) PRIMARY KEY,
  project_id  VARCHAR(36) NOT NULL,
  agent_name  VARCHAR(50) NOT NULL,
  result      VARCHAR(20) NOT NULL,
  summary     TEXT NOT NULL,
  details     JSON NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_agent_log_project (project_id, created_at),
  INDEX idx_agent_log_agent (agent_name),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
