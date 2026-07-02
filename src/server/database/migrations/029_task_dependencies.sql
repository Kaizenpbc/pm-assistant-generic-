-- Migration 029: Multi-dependency support via junction table
-- Old denormalized columns (dependency, dependency_type, dependency_lag_days) remain for backward compat

CREATE TABLE IF NOT EXISTS task_dependencies (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  task_id VARCHAR(36) NOT NULL,
  dependency_id VARCHAR(36) NOT NULL,
  dependency_type ENUM('FS','SS','FF','SF') NOT NULL DEFAULT 'FS',
  lag_days INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_task_dep (task_id, dependency_id),
  INDEX idx_dep_id (dependency_id),
  CONSTRAINT fk_td_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_td_dep FOREIGN KEY (dependency_id) REFERENCES tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migrate existing single-dependency data into junction table
INSERT INTO task_dependencies (id, task_id, dependency_id, dependency_type, lag_days)
SELECT UUID(), id, dependency, COALESCE(dependency_type, 'FS'), COALESCE(dependency_lag_days, 0)
FROM tasks
WHERE dependency IS NOT NULL AND dependency != '';
