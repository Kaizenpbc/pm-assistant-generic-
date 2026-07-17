-- Token top-up purchases for AI budget overages
CREATE TABLE IF NOT EXISTS token_top_ups (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  tokens_purchased INT NOT NULL,
  tokens_remaining INT NOT NULL,
  amount_cents INT NOT NULL,
  stripe_session_id VARCHAR(255) NULL,
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  INDEX idx_topup_user (user_id),
  INDEX idx_topup_user_remaining (user_id, tokens_remaining),
  INDEX idx_topup_stripe (stripe_session_id)
);
