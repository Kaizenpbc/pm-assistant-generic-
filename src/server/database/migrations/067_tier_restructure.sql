-- Migration 067: Tier restructure (free/pro/business/consultant → trial/consultant/sme/enterprise)
--
-- Old mapping:
--   free       → trial
--   pro        → consultant
--   business   → sme
--   consultant → enterprise

-- Step 1: Expand users ENUM to include both old and new values
ALTER TABLE users
  MODIFY COLUMN subscription_tier
  ENUM('free','pro','business','consultant','trial','sme','enterprise')
  NOT NULL DEFAULT 'trial';

-- Step 2: Migrate user data (order matters — old consultant must move FIRST)
UPDATE users SET subscription_tier = 'enterprise' WHERE subscription_tier = 'consultant';
UPDATE users SET subscription_tier = 'sme' WHERE subscription_tier = 'business';
UPDATE users SET subscription_tier = 'consultant' WHERE subscription_tier = 'pro';
UPDATE users SET subscription_tier = 'trial' WHERE subscription_tier = 'free';

-- Step 3: Shrink ENUM to final values
ALTER TABLE users
  MODIFY COLUMN subscription_tier
  ENUM('trial','consultant','sme','enterprise')
  NOT NULL DEFAULT 'trial';

-- Same for organizations
ALTER TABLE organizations
  MODIFY COLUMN subscription_tier
  ENUM('free','pro','business','consultant','trial','sme','enterprise')
  DEFAULT 'trial';

UPDATE organizations SET subscription_tier = 'enterprise' WHERE subscription_tier = 'consultant';
UPDATE organizations SET subscription_tier = 'sme' WHERE subscription_tier = 'business';
UPDATE organizations SET subscription_tier = 'consultant' WHERE subscription_tier = 'pro';
UPDATE organizations SET subscription_tier = 'trial' WHERE subscription_tier = 'free';

ALTER TABLE organizations
  MODIFY COLUMN subscription_tier
  ENUM('trial','consultant','sme','enterprise')
  DEFAULT 'trial';
