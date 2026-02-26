-- Migration 002: Auth & Subscriptions
-- Adds email verification, password reset, Stripe billing fields to users table
-- Creates subscriptions table for Stripe subscription tracking

-- Add auth and subscription columns to users table
ALTER TABLE users
  ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE AFTER password_hash,
  ADD COLUMN email_verification_token VARCHAR(255) NULL AFTER email_verified,
  ADD COLUMN email_verification_expires DATETIME NULL AFTER email_verification_token,
  ADD COLUMN password_reset_token VARCHAR(255) NULL AFTER email_verification_expires,
  ADD COLUMN password_reset_expires DATETIME NULL AFTER password_reset_token,
  ADD COLUMN stripe_customer_id VARCHAR(255) NULL AFTER password_reset_expires,
  ADD COLUMN subscription_tier ENUM('free', 'pro', 'business') NOT NULL DEFAULT 'free' AFTER stripe_customer_id,
  ADD COLUMN subscription_status ENUM('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'none') NOT NULL DEFAULT 'none' AFTER subscription_tier,
  ADD COLUMN trial_ends_at DATETIME NULL AFTER subscription_status;

-- Add indexes for token lookups
CREATE INDEX idx_users_email_verification_token ON users(email_verification_token);
CREATE INDEX idx_users_password_reset_token ON users(password_reset_token);
CREATE INDEX idx_users_stripe_customer_id ON users(stripe_customer_id);

-- Subscriptions table for detailed Stripe subscription data
CREATE TABLE IF NOT EXISTS subscriptions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  stripe_subscription_id VARCHAR(255) NOT NULL,
  stripe_price_id VARCHAR(255) NOT NULL,
  status ENUM('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid') NOT NULL DEFAULT 'active',
  current_period_start DATETIME NOT NULL,
  current_period_end DATETIME NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  canceled_at DATETIME NULL,
  trial_start DATETIME NULL,
  trial_end DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY idx_stripe_subscription_id (stripe_subscription_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mark existing users as verified (they were created before verification was required)
UPDATE users SET email_verified = TRUE WHERE email_verified = FALSE;

-- Record this migration
INSERT INTO _migrations (name) VALUES ('002_auth_and_subscriptions');
