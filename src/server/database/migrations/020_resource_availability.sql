-- 020: Resource availability / calendar
CREATE TABLE IF NOT EXISTS resource_availability (
  id VARCHAR(36) PRIMARY KEY,
  resource_id VARCHAR(36) NOT NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  type ENUM('vacation','holiday','unavailable','reduced') NOT NULL DEFAULT 'unavailable',
  hours_available DECIMAL(4,1) DEFAULT NULL,
  note VARCHAR(500) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
  INDEX idx_avail_resource (resource_id),
  INDEX idx_avail_dates (date_from, date_to)
);
