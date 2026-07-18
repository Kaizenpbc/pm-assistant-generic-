-- 069_sme_seat_billing.sql
-- Add seat-based billing columns to organizations for SME per-seat model

ALTER TABLE organizations
  ADD COLUMN stripe_subscription_id VARCHAR(255) NULL
    AFTER stripe_customer_id,
  ADD COLUMN stripe_subscription_item_id VARCHAR(255) NULL
    AFTER stripe_subscription_id,
  ADD COLUMN billing_model ENUM('flat','per_seat') NOT NULL DEFAULT 'flat'
    AFTER subscription_status,
  ADD COLUMN seat_count INT NOT NULL DEFAULT 1
    AFTER billing_model,
  ADD COLUMN seat_price_cents INT NOT NULL DEFAULT 3300
    AFTER seat_count;

-- SME orgs get unlimited viewers
UPDATE organizations SET viewer_limit = 999999 WHERE subscription_tier = 'sme';
