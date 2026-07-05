-- Rollback 032_role_expansion
-- Revert new roles back to old names
UPDATE users SET role = 'manager' WHERE role = 'project_manager';
UPDATE users SET role = 'member' WHERE role = 'team_member';
UPDATE users SET role = 'member' WHERE role IN ('scrum_master', 'finance_officer');

-- Shrink ENUM back to original 4 values
ALTER TABLE users MODIFY COLUMN role ENUM('admin','executive','manager','member') NOT NULL DEFAULT 'member';
