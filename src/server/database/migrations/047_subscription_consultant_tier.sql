-- Add 'consultant' to subscription_tier ENUM and migrate existing pro/business users
-- Also add trial_started_at for accurate trial tracking

-- Step 1: Expand ENUM to include 'consultant'
ALTER TABLE users
  MODIFY COLUMN subscription_tier ENUM('free', 'pro', 'business', 'consultant') NOT NULL DEFAULT 'free';

-- Step 2: Migrate existing pro/business users to consultant
UPDATE users SET subscription_tier = 'consultant' WHERE subscription_tier IN ('pro', 'business');

-- Step 3: Add trial_started_at column
ALTER TABLE users
  ADD COLUMN trial_started_at DATETIME NULL AFTER trial_ends_at;

-- Step 4: Backfill trial_started_at from created_at for users who have a trial_ends_at
UPDATE users SET trial_started_at = created_at WHERE trial_ends_at IS NOT NULL AND trial_started_at IS NULL;
