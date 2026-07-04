-- Migration 036: Expand user roles from 6 to 13
-- Adds: risk_manager, pmo, ba, qa, tester, devops, claude_sme

-- Step 1: Expand ENUM to include all 13 values
ALTER TABLE users
  MODIFY COLUMN role ENUM(
    'admin', 'executive', 'project_manager', 'team_member', 'scrum_master', 'finance_officer',
    'risk_manager', 'pmo', 'ba', 'qa', 'tester', 'devops', 'claude_sme'
  ) NOT NULL DEFAULT 'team_member';
