-- Rollback 027_user_locale
ALTER TABLE users DROP COLUMN IF EXISTS locale;
