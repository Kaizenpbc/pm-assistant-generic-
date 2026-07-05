-- Rollback 017_admin_last_login
DROP INDEX idx_users_last_login ON users;
ALTER TABLE users DROP COLUMN IF EXISTS last_login_at;
