-- T002_missing_tables.sql — Tables and columns missing from T001 baseline
-- Added: task_comments, task_activities, user_favourite_projects,
--        webhook_deliveries, baselines, templates, resource_assignments,
--        workflow_rules, user_notification_preferences
-- Columns: projects.archived_at

CREATE TABLE IF NOT EXISTS task_comments (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  task_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  user_name VARCHAR(255) NOT NULL DEFAULT '',
  text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tc_task_id (task_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_activities (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  task_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  user_name VARCHAR(255) NOT NULL DEFAULT '',
  action VARCHAR(100) NOT NULL,
  field VARCHAR(100) DEFAULT NULL,
  old_value TEXT DEFAULT NULL,
  new_value TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ta_task_id (task_id),
  INDEX idx_ta_created_at (created_at),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_favourite_projects (
  user_id CHAR(36) NOT NULL,
  project_id CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, project_id),
  INDEX idx_user_favourite_user (user_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  webhook_id VARCHAR(36) NOT NULL,
  event VARCHAR(100) NOT NULL,
  payload JSON DEFAULT NULL,
  status_code INT DEFAULT NULL,
  response_time_ms INT DEFAULT NULL,
  error TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_deliveries_webhook (webhook_id),
  INDEX idx_deliveries_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS baselines (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  schedule_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  snapshot JSON NOT NULL,
  created_by VARCHAR(36) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_baselines_schedule_id (schedule_id),
  FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS templates (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  category VARCHAR(100) DEFAULT NULL,
  project_type VARCHAR(50) DEFAULT NULL,
  default_duration INT DEFAULT NULL,
  phases JSON DEFAULT NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  created_by VARCHAR(36) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_templates_category (category),
  INDEX idx_templates_project_type (project_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS resource_assignments (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  resource_id VARCHAR(36) NOT NULL,
  task_id VARCHAR(36) NOT NULL,
  schedule_id VARCHAR(36) NOT NULL,
  hours_per_week INT NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ra_resource_id (resource_id),
  INDEX idx_ra_task_id (task_id),
  INDEX idx_ra_schedule_id (schedule_id),
  FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workflow_rules (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  trigger_event VARCHAR(100) NOT NULL,
  conditions JSON DEFAULT NULL,
  actions JSON DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  project_id VARCHAR(36) DEFAULT NULL,
  created_by VARCHAR(36) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_wr_project_id (project_id),
  INDEX idx_wr_trigger_event (trigger_event)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  category VARCHAR(50) NOT NULL,
  in_app TINYINT(1) NOT NULL DEFAULT 1,
  email TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_category (user_id, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add archived_at column to projects (from migration 059)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_at DATETIME DEFAULT NULL;
ALTER TABLE projects ADD INDEX IF NOT EXISTS idx_projects_archived (archived_at);

-- Add data retention indexes (from migration 061)
ALTER TABLE notifications ADD INDEX IF NOT EXISTS idx_notif_read_created (is_read, created_at);
ALTER TABLE dead_letter_queue ADD INDEX IF NOT EXISTS idx_dlq_status_created (status, created_at);

-- Standup summaries (from migration 073)
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
