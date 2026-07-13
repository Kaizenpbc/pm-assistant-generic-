-- Add token_version to users for session invalidation
-- Incrementing this value invalidates all existing JWTs for the user
ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 0;
