ALTER TABLE users ADD COLUMN last_login_at DATETIME NULL;
ALTER TABLE users ADD INDEX idx_users_last_login (last_login_at);
