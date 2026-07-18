CREATE TABLE IF NOT EXISTS subscription_events (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  event_type ENUM('subscription_created','tier_changed','subscription_renewed',
    'subscription_canceled','payment_failed','payment_succeeded',
    'trial_started','trial_expired','topup_purchased') NOT NULL,
  previous_tier VARCHAR(50) NULL,
  new_tier VARCHAR(50) NULL,
  amount_cents INT NULL,
  stripe_event_id VARCHAR(255) NULL,
  metadata JSON NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sub_events_user (user_id),
  INDEX idx_sub_events_type (event_type),
  INDEX idx_sub_events_created (created_at DESC),
  UNIQUE KEY idx_sub_events_stripe_dedup (stripe_event_id, event_type)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
