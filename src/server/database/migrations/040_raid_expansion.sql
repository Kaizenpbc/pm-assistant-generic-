-- Migration 040: RAID Expansion — Actions & Decisions, Sequential IDs, Activity Log
-- Expands the RAID framework from Risks+Issues to full RAID (Risks, Actions, Issues, Decisions)
-- Adds BMC Remedy/Helix ITSM-inspired features: global sequential IDs, activity logging,
-- cancel/reverse semantics, related items linking.

-- 1. Expand type ENUM to include actions and decisions
ALTER TABLE project_risks MODIFY COLUMN type
  ENUM('risk','issue','action','decision') NOT NULL DEFAULT 'risk';

-- 2. Expand status ENUM with new statuses for all types
ALTER TABLE project_risks MODIFY COLUMN status
  ENUM('open','monitoring','mitigating','mitigated','closed','resolved',
       'cancelled','reversed','in_progress','completed',
       'pending_decision','decided','deferred') NOT NULL DEFAULT 'open';

-- 3. Global sequence counter table
CREATE TABLE IF NOT EXISTS raid_sequence_counter (
  type VARCHAR(10) PRIMARY KEY,
  next_val INT UNSIGNED NOT NULL DEFAULT 1
) ENGINE=InnoDB;

INSERT INTO raid_sequence_counter (type, next_val)
  VALUES ('risk', 1), ('issue', 1), ('action', 1), ('decision', 1);

-- 4. Sequential ID columns
ALTER TABLE project_risks ADD COLUMN sequence_number INT UNSIGNED NULL;
ALTER TABLE project_risks ADD COLUMN record_id VARCHAR(10) NULL;
ALTER TABLE project_risks ADD UNIQUE INDEX idx_project_risks_record_id (record_id);

-- 5. Action-specific columns
ALTER TABLE project_risks ADD COLUMN due_date DATE NULL;
ALTER TABLE project_risks ADD COLUMN action_type ENUM('preventive','corrective','improvement') NULL;

-- 6. Decision-specific columns
ALTER TABLE project_risks ADD COLUMN rationale TEXT NULL;
ALTER TABLE project_risks ADD COLUMN decided_by CHAR(36) NULL;
ALTER TABLE project_risks ADD COLUMN decision_date DATE NULL;
ALTER TABLE project_risks ADD COLUMN alternatives_considered TEXT NULL;
ALTER TABLE project_risks ADD COLUMN stakeholders_consulted JSON NULL;

-- 7. Cancel/reverse + related items
ALTER TABLE project_risks ADD COLUMN cancel_reason TEXT NULL;
ALTER TABLE project_risks ADD COLUMN linked_raid_ids JSON NULL;

-- 8. Activity log table
CREATE TABLE IF NOT EXISTS raid_activity_log (
  id CHAR(36) PRIMARY KEY,
  raid_item_id CHAR(36) NOT NULL,
  project_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  action_type ENUM('comment','status_change','field_update',
                   'created','cancelled','reversed','linked') NOT NULL,
  field_name VARCHAR(64) NULL,
  old_value TEXT NULL,
  new_value TEXT NULL,
  comment TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_raid_activity_item (raid_item_id, created_at),
  INDEX idx_raid_activity_project (project_id, created_at)
) ENGINE=InnoDB;

-- 9. Backfill existing risk records with sequential IDs
UPDATE project_risks pr
  JOIN (SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
        FROM project_risks WHERE type='risk') ranked ON pr.id = ranked.id
  SET pr.sequence_number = ranked.rn,
      pr.record_id = CONCAT('R-', LPAD(ranked.rn, 3, '0'))
  WHERE pr.type = 'risk';

SET @rc = (SELECT COALESCE(MAX(sequence_number), 0) FROM project_risks WHERE type='risk');
UPDATE raid_sequence_counter SET next_val = @rc + 1 WHERE type = 'risk';

-- 10. Backfill existing issue records with sequential IDs
UPDATE project_risks pr
  JOIN (SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
        FROM project_risks WHERE type='issue') ranked ON pr.id = ranked.id
  SET pr.sequence_number = ranked.rn,
      pr.record_id = CONCAT('I-', LPAD(ranked.rn, 3, '0'))
  WHERE pr.type = 'issue';

SET @ic = (SELECT COALESCE(MAX(sequence_number), 0) FROM project_risks WHERE type='issue');
UPDATE raid_sequence_counter SET next_val = @ic + 1 WHERE type = 'issue';
