-- Rollback 002_auth_and_subscriptions
DROP TABLE IF EXISTS subscriptions;

DROP INDEX idx_users_email_verification_token ON users;
DROP INDEX idx_users_password_reset_token ON users;
DROP INDEX idx_users_stripe_customer_id ON users;

ALTER TABLE users
  DROP COLUMN IF EXISTS email_verified,
  DROP COLUMN IF EXISTS email_verification_token,
  DROP COLUMN IF EXISTS email_verification_expires,
  DROP COLUMN IF EXISTS password_reset_token,
  DROP COLUMN IF EXISTS password_reset_expires,
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS subscription_tier,
  DROP COLUMN IF EXISTS subscription_status,
  DROP COLUMN IF EXISTS trial_ends_at;

DELETE FROM _migrations WHERE name = '002_auth_and_subscriptions';
