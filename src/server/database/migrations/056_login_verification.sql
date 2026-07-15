-- Login verification (2FA via email link)
ALTER TABLE users
  ADD COLUMN login_verification_token VARCHAR(255) DEFAULT NULL,
  ADD COLUMN login_verification_expires DATETIME DEFAULT NULL;

CREATE INDEX idx_users_login_verification_token ON users (login_verification_token);
