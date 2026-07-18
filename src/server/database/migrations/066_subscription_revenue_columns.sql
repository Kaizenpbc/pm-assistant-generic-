ALTER TABLE subscriptions
  ADD COLUMN amount_cents INT NULL AFTER stripe_price_id,
  ADD COLUMN currency VARCHAR(3) NULL DEFAULT 'usd' AFTER amount_cents,
  ADD COLUMN billing_interval ENUM('month','year') NULL AFTER currency;
