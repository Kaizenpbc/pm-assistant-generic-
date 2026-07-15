-- Favourite/pinned projects per user
CREATE TABLE IF NOT EXISTS user_favourite_projects (
  user_id CHAR(36) NOT NULL,
  project_id CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, project_id),
  INDEX idx_user_favourite_user (user_id),
  CONSTRAINT fk_favourite_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
