-- Rollback 036_role_expansion_phase2
-- Map phase2 roles back to closest phase1 equivalents
UPDATE users SET role = 'project_manager' WHERE role IN ('risk_manager', 'pmo', 'ba', 'devops');
UPDATE users SET role = 'team_member' WHERE role IN ('qa', 'tester', 'claude_sme');

-- Shrink ENUM back to 6 values
ALTER TABLE users MODIFY COLUMN role ENUM('admin','executive','project_manager','team_member','scrum_master','finance_officer') NOT NULL DEFAULT 'team_member';
