-- Create admin user (password: test123)
-- Run: mysql -u root pm_assistant < seed-admin.sql

INSERT INTO users (id, username, email, password_hash, full_name, role, is_active, email_verified)
VALUES (
  UUID(),
  'admin',
  'admin@kovarti.com',
  '$2b$12$rryPfbodo4MCQCIG5Rx/ue/NdFbJbR0yvzO.T2fA5vsJlpDk02D1a',
  'Admin',
  'admin',
  1,
  1
)
ON DUPLICATE KEY UPDATE
  password_hash = '$2b$12$rryPfbodo4MCQCIG5Rx/ue/NdFbJbR0yvzO.T2fA5vsJlpDk02D1a',
  role = 'admin';
