-- Add viewer role to users table
ALTER TABLE users MODIFY COLUMN role ENUM(
  'admin', 'executive', 'project_manager', 'team_member', 'scrum_master',
  'finance_officer', 'risk_manager', 'pmo', 'ba', 'qa', 'tester', 'devops',
  'claude_sme', 'viewer'
) NOT NULL DEFAULT 'team_member';
