-- 013_embeddings_and_rag.sql
-- Persist lessons learned, meeting analyses, and vector embeddings for RAG

CREATE TABLE IF NOT EXISTS lessons_learned (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  project_name VARCHAR(200) NOT NULL,
  project_type VARCHAR(100) NOT NULL,
  category ENUM('schedule','budget','resource','risk','technical','communication','stakeholder','quality') NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  impact ENUM('positive','negative','neutral') NOT NULL,
  recommendation TEXT NOT NULL,
  confidence TINYINT UNSIGNED NOT NULL DEFAULT 80,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ll_project (project_id),
  INDEX idx_ll_category (category),
  INDEX idx_ll_project_type (project_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS meeting_analyses (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  schedule_id VARCHAR(36) NOT NULL,
  transcript LONGTEXT NOT NULL,
  summary TEXT NOT NULL,
  action_items JSON NOT NULL,
  decisions JSON NOT NULL,
  risks JSON NOT NULL,
  task_updates JSON NOT NULL,
  applied_items JSON NOT NULL DEFAULT ('[]'),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ma_project (project_id),
  INDEX idx_ma_schedule (schedule_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS embeddings (
  id VARCHAR(36) PRIMARY KEY,
  document_type ENUM('lesson','meeting') NOT NULL,
  document_id VARCHAR(64) NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  embedding JSON NOT NULL,
  model VARCHAR(50) NOT NULL DEFAULT 'text-embedding-3-small',
  dimensions SMALLINT UNSIGNED NOT NULL DEFAULT 1536,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX idx_emb_document (document_type, document_id),
  INDEX idx_emb_type (document_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO _migrations (name) VALUES ('013_embeddings_and_rag');
