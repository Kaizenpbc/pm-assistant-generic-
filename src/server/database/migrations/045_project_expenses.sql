-- Project expenses table for tracking non-labor costs
CREATE TABLE IF NOT EXISTS project_expenses (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  category ENUM('labor','materials','software','hardware','travel','contractors','training','consulting','licenses','other') NOT NULL DEFAULT 'other',
  vendor VARCHAR(255) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  receipt_attachment_id VARCHAR(36) DEFAULT NULL,
  created_by VARCHAR(36) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_expenses_project (project_id),
  INDEX idx_expenses_date (project_id, date),
  INDEX idx_expenses_category (project_id, category)
);
