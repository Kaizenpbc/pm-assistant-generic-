-- Migration 032: Expand user roles from 4 to 6
-- Adds: scrum_master, finance_officer
-- Renames: manager -> project_manager, member -> team_member

-- Step 1: Expand the ENUM to include all 6 values (old + new)
ALTER TABLE users
  MODIFY COLUMN role ENUM('admin', 'executive', 'manager', 'member', 'project_manager', 'team_member', 'scrum_master', 'finance_officer')
  NOT NULL DEFAULT 'team_member';

-- Step 2: Migrate existing data
UPDATE users SET role = 'project_manager' WHERE role = 'manager';
UPDATE users SET role = 'team_member' WHERE role = 'member';

-- Step 3: Shrink ENUM to only the new values (removes old names)
ALTER TABLE users
  MODIFY COLUMN role ENUM('admin', 'executive', 'project_manager', 'team_member', 'scrum_master', 'finance_officer')
  NOT NULL DEFAULT 'team_member';
