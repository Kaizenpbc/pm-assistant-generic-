-- PM Assistant Generic — Initial Schema
-- Migration 001: Create all core tables
-- ============================================================================

-- --------------------------------------------------------------------------
-- Users
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id          VARCHAR(36) NOT NULL PRIMARY KEY,
  username    VARCHAR(100) NOT NULL UNIQUE,
  email       VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name   VARCHAR(255) NOT NULL DEFAULT '',
  role        ENUM('admin','executive','manager','member') NOT NULL DEFAULT 'member',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_username (username),
  INDEX idx_users_email (email),
  INDEX idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- Projects
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id               VARCHAR(36) NOT NULL PRIMARY KEY,
  name             VARCHAR(255) NOT NULL,
  description      TEXT,
  category         VARCHAR(100),
  project_type     ENUM('it','construction','infrastructure','roads','other') NOT NULL DEFAULT 'other',
  status           ENUM('planning','active','on_hold','completed','cancelled') NOT NULL DEFAULT 'planning',
  priority         ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
  budget_allocated DECIMAL(15,2) DEFAULT NULL,
  budget_spent     DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  currency         VARCHAR(10) NOT NULL DEFAULT 'USD',
  location         VARCHAR(255),
  location_lat     DECIMAL(10,7),
  location_lon     DECIMAL(10,7),
  start_date       DATE,
  end_date         DATE,
  project_manager_id VARCHAR(36),
  created_by       VARCHAR(36) NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_projects_status (status),
  INDEX idx_projects_type (project_type),
  INDEX idx_projects_created_by (created_by),
  INDEX idx_projects_priority (priority),
  CONSTRAINT fk_projects_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- Project Members (RBAC per project)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_members (
  id          VARCHAR(36) NOT NULL PRIMARY KEY,
  project_id  VARCHAR(36) NOT NULL,
  user_id     VARCHAR(36) NOT NULL,
  user_name   VARCHAR(255) NOT NULL DEFAULT '',
  email       VARCHAR(255) NOT NULL DEFAULT '',
  role        ENUM('owner','manager','editor','viewer') NOT NULL DEFAULT 'viewer',
  added_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_project_user (project_id, user_id),
  INDEX idx_pm_user_id (user_id),
  CONSTRAINT fk_pm_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_pm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- Schedules
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schedules (
  id          VARCHAR(36) NOT NULL PRIMARY KEY,
  project_id  VARCHAR(36) NOT NULL,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  status      ENUM('pending','active','completed','on_hold','cancelled') NOT NULL DEFAULT 'active',
  created_by  VARCHAR(36) NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_schedules_project_id (project_id),
  INDEX idx_schedules_status (status),
  CONSTRAINT fk_schedules_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- Tasks
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id                      VARCHAR(36) NOT NULL PRIMARY KEY,
  schedule_id             VARCHAR(36) NOT NULL,
  name                    VARCHAR(255) NOT NULL,
  description             TEXT,
  status                  ENUM('pending','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending',
  priority                ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
  assigned_to             VARCHAR(36),
  due_date                DATE,
  estimated_days          INT,
  estimated_duration_hours DECIMAL(8,2),
  actual_duration_hours   DECIMAL(8,2),
  start_date              DATE,
  end_date                DATE,
  progress_percentage     TINYINT UNSIGNED DEFAULT 0,
  dependency              VARCHAR(36),
  dependency_type         ENUM('FS','SS','FF','SF'),
  risks                   TEXT,
  issues                  TEXT,
  comments                TEXT,
  parent_task_id          VARCHAR(36),
  created_by              VARCHAR(36) NOT NULL,
  created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tasks_schedule_id (schedule_id),
  INDEX idx_tasks_status (status),
  INDEX idx_tasks_assigned_to (assigned_to),
  INDEX idx_tasks_parent_task_id (parent_task_id),
  INDEX idx_tasks_dependency (dependency),
  CONSTRAINT fk_tasks_schedule FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- Task Comments
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_comments (
  id          VARCHAR(36) NOT NULL PRIMARY KEY,
  task_id     VARCHAR(36) NOT NULL,
  user_id     VARCHAR(36) NOT NULL,
  user_name   VARCHAR(255) NOT NULL DEFAULT '',
  text        TEXT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tc_task_id (task_id),
  CONSTRAINT fk_tc_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- Task Activity Log
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_activities (
  id          VARCHAR(36) NOT NULL PRIMARY KEY,
  task_id     VARCHAR(36) NOT NULL,
  user_id     VARCHAR(36) NOT NULL,
  user_name   VARCHAR(255) NOT NULL DEFAULT '',
  action      VARCHAR(100) NOT NULL,
  field       VARCHAR(100),
  old_value   TEXT,
  new_value   TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ta_task_id (task_id),
  INDEX idx_ta_created_at (created_at),
  CONSTRAINT fk_ta_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- Resources
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resources (
  id                      VARCHAR(36) NOT NULL PRIMARY KEY,
  name                    VARCHAR(255) NOT NULL,
  role                    VARCHAR(100) NOT NULL DEFAULT '',
  email                   VARCHAR(255) NOT NULL DEFAULT '',
  capacity_hours_per_week INT NOT NULL DEFAULT 40,
  skills                  JSON,
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_resources_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- Resource Assignments
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resource_assignments (
  id              VARCHAR(36) NOT NULL PRIMARY KEY,
  resource_id     VARCHAR(36) NOT NULL,
  task_id         VARCHAR(36) NOT NULL,
  schedule_id     VARCHAR(36) NOT NULL,
  hours_per_week  INT NOT NULL DEFAULT 0,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ra_resource_id (resource_id),
  INDEX idx_ra_task_id (task_id),
  INDEX idx_ra_schedule_id (schedule_id),
  CONSTRAINT fk_ra_resource FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
  CONSTRAINT fk_ra_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_ra_schedule FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- Templates
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS templates (
  id               VARCHAR(36) NOT NULL PRIMARY KEY,
  name             VARCHAR(255) NOT NULL,
  description      TEXT,
  category         VARCHAR(100),
  project_type     VARCHAR(50),
  default_duration INT COMMENT 'Default duration in days',
  phases           JSON COMMENT 'Array of phase objects with name, tasks, etc.',
  is_system        BOOLEAN NOT NULL DEFAULT FALSE,
  created_by       VARCHAR(36),
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_templates_category (category),
  INDEX idx_templates_project_type (project_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- Workflow Rules
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workflow_rules (
  id          VARCHAR(36) NOT NULL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  trigger_event VARCHAR(100) NOT NULL,
  conditions  JSON,
  actions     JSON,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  project_id  VARCHAR(36),
  created_by  VARCHAR(36),
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_wr_project_id (project_id),
  INDEX idx_wr_trigger_event (trigger_event)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- Workflow Executions
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workflow_executions (
  id          VARCHAR(36) NOT NULL PRIMARY KEY,
  rule_id     VARCHAR(36) NOT NULL,
  trigger_data JSON,
  result      JSON,
  status      ENUM('success','failure','skipped') NOT NULL DEFAULT 'success',
  executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_we_rule_id (rule_id),
  INDEX idx_we_executed_at (executed_at),
  CONSTRAINT fk_we_rule FOREIGN KEY (rule_id) REFERENCES workflow_rules(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- Schedule Baselines
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS baselines (
  id          VARCHAR(36) NOT NULL PRIMARY KEY,
  schedule_id VARCHAR(36) NOT NULL,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  snapshot    JSON NOT NULL COMMENT 'Full snapshot of tasks at baseline time',
  created_by  VARCHAR(36),
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_baselines_schedule_id (schedule_id),
  CONSTRAINT fk_baselines_schedule FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- Auto-Reschedule Proposals
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reschedule_proposals (
  id              VARCHAR(36) NOT NULL PRIMARY KEY,
  schedule_id     VARCHAR(36) NOT NULL,
  trigger_task_id VARCHAR(36),
  proposal_data   JSON NOT NULL,
  status          ENUM('pending','accepted','rejected','expired') NOT NULL DEFAULT 'pending',
  created_by      VARCHAR(36),
  decided_by      VARCHAR(36),
  decided_at      TIMESTAMP NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rp_schedule_id (schedule_id),
  INDEX idx_rp_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- Lessons Learned
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lessons_learned (
  id          VARCHAR(36) NOT NULL PRIMARY KEY,
  project_id  VARCHAR(36),
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  category    VARCHAR(100),
  impact      ENUM('low','medium','high') DEFAULT 'medium',
  tags        JSON,
  created_by  VARCHAR(36),
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ll_project_id (project_id),
  INDEX idx_ll_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- Meeting Analyses
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meeting_analyses (
  id              VARCHAR(36) NOT NULL PRIMARY KEY,
  project_id      VARCHAR(36),
  title           VARCHAR(255) NOT NULL,
  meeting_date    DATE,
  transcript      MEDIUMTEXT,
  analysis_result JSON,
  ai_powered      BOOLEAN NOT NULL DEFAULT FALSE,
  created_by      VARCHAR(36),
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ma_project_id (project_id),
  INDEX idx_ma_meeting_date (meeting_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- AI Conversations (Chat)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_conversations (
  id            VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id       VARCHAR(36) NOT NULL,
  project_id    VARCHAR(36),
  context_type  VARCHAR(50) NOT NULL DEFAULT 'general',
  title         VARCHAR(255),
  messages      JSON,
  token_count   INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ac_user_id (user_id),
  INDEX idx_ac_project_id (project_id),
  INDEX idx_ac_context_type (context_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- AI Usage Log
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id              VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id         VARCHAR(36),
  feature         VARCHAR(100) NOT NULL,
  model           VARCHAR(50) NOT NULL DEFAULT 'claude',
  input_tokens    INT NOT NULL DEFAULT 0,
  output_tokens   INT NOT NULL DEFAULT 0,
  cost_estimate   DECIMAL(10,6) DEFAULT 0,
  latency_ms      INT NOT NULL DEFAULT 0,
  success         BOOLEAN NOT NULL DEFAULT TRUE,
  error_message   TEXT,
  request_context JSON,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_aul_user_id (user_id),
  INDEX idx_aul_feature (feature),
  INDEX idx_aul_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- AI Feedback
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_feedback (
  id              VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id         VARCHAR(36),
  project_id      VARCHAR(36),
  feature         VARCHAR(100) NOT NULL,
  suggestion_data JSON,
  user_action     ENUM('accepted','modified','rejected') NOT NULL,
  modified_data   JSON,
  feedback_text   TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_af_user_id (user_id),
  INDEX idx_af_feature (feature),
  INDEX idx_af_user_action (user_action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- AI Accuracy Tracking
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_accuracy_tracking (
  id              VARCHAR(36) NOT NULL PRIMARY KEY,
  project_id      VARCHAR(36),
  task_id         VARCHAR(36),
  metric_type     VARCHAR(100) NOT NULL,
  predicted_value DECIMAL(15,4) NOT NULL,
  actual_value    DECIMAL(15,4) NOT NULL,
  variance_pct    DECIMAL(8,2) NOT NULL DEFAULT 0,
  project_type    VARCHAR(50),
  recorded_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_aat_project_id (project_id),
  INDEX idx_aat_metric_type (metric_type),
  INDEX idx_aat_recorded_at (recorded_at),
  INDEX idx_aat_project_type (project_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------------
-- Migration Tracking
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS _migrations (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255) NOT NULL UNIQUE,
  applied_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
