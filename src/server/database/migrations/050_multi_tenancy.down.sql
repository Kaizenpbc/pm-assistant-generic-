-- Rollback multi-tenancy
ALTER TABLE users DROP INDEX IF EXISTS idx_user_org;
ALTER TABLE users DROP COLUMN IF EXISTS organization_id;
DROP TABLE IF EXISTS organizations;
