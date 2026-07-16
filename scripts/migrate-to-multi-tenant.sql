-- migrate-to-multi-tenant.sql
-- Migrates existing shared-DB data into per-tenant databases.
-- Run with: sudo mariadb < /tmp/migrate-to-multi-tenant.sql
--
-- Steps:
--   1. Fix test-org provisioned flag (DB doesn't exist)
--   2. Create orgs for users without one
--   3. Create tenant databases + run baseline
--   4. Copy project-scoped data for admin and Mike_todo
--   5. Copy user-scoped data (chat, notifications, webhooks, etc.)
--   6. Mark all orgs as provisioned

-- ============================================================
-- Step 1: Fix test-org (marked provisioned but DB missing)
-- ============================================================
UPDATE pmassist.organizations SET is_provisioned = 0 WHERE slug = 'test-org';

-- ============================================================
-- Step 2: Create orgs for users without one
-- ============================================================

-- gerogebailoo@gmail.com
INSERT IGNORE INTO pmassist.organizations (id, name, slug, db_name, owner_user_id, is_active, is_provisioned, created_at, updated_at)
VALUES (UUID(), 'gerogebailoo', 'gerogebailoo', 'pmassist_t_gerogebailoo', '1f3f88b3-109a-4ffd-9260-8731c90d2204', 1, 0, NOW(), NOW());
UPDATE pmassist.users SET organization_id = (SELECT id FROM pmassist.organizations WHERE slug = 'gerogebailoo') WHERE id = '1f3f88b3-109a-4ffd-9260-8731c90d2204' AND organization_id IS NULL;

-- test_finance
INSERT IGNORE INTO pmassist.organizations (id, name, slug, db_name, owner_user_id, is_active, is_provisioned, created_at, updated_at)
VALUES (UUID(), 'test_finance', 'test-finance', 'pmassist_t_test_finance', '2c7dbbe2-d5b5-483d-af49-b85c9b6d9ae1', 1, 0, NOW(), NOW());
UPDATE pmassist.users SET organization_id = (SELECT id FROM pmassist.organizations WHERE slug = 'test-finance') WHERE id = '2c7dbbe2-d5b5-483d-af49-b85c9b6d9ae1' AND organization_id IS NULL;

-- kpbcma@gmail.com
INSERT IGNORE INTO pmassist.organizations (id, name, slug, db_name, owner_user_id, is_active, is_provisioned, created_at, updated_at)
VALUES (UUID(), 'kpbcma', 'kpbcma', 'pmassist_t_kpbcma', '3ab7584e-dee2-43f3-9c71-f0e01b66df15', 1, 0, NOW(), NOW());
UPDATE pmassist.users SET organization_id = (SELECT id FROM pmassist.organizations WHERE slug = 'kpbcma') WHERE id = '3ab7584e-dee2-43f3-9c71-f0e01b66df15' AND organization_id IS NULL;

-- test_pm
INSERT IGNORE INTO pmassist.organizations (id, name, slug, db_name, owner_user_id, is_active, is_provisioned, created_at, updated_at)
VALUES (UUID(), 'test_pm', 'test-pm', 'pmassist_t_test_pm', '3b2be50f-7a85-40c9-85c2-df97ed34d296', 1, 0, NOW(), NOW());
UPDATE pmassist.users SET organization_id = (SELECT id FROM pmassist.organizations WHERE slug = 'test-pm') WHERE id = '3b2be50f-7a85-40c9-85c2-df97ed34d296' AND organization_id IS NULL;

-- Manjot
INSERT IGNORE INTO pmassist.organizations (id, name, slug, db_name, owner_user_id, is_active, is_provisioned, created_at, updated_at)
VALUES (UUID(), 'Manjot', 'manjot', 'pmassist_t_manjot', '400cbcb1-a664-48d5-baf7-2e9b69242e41', 1, 0, NOW(), NOW());
UPDATE pmassist.users SET organization_id = (SELECT id FROM pmassist.organizations WHERE slug = 'manjot') WHERE id = '400cbcb1-a664-48d5-baf7-2e9b69242e41' AND organization_id IS NULL;

-- test_scrum
INSERT IGNORE INTO pmassist.organizations (id, name, slug, db_name, owner_user_id, is_active, is_provisioned, created_at, updated_at)
VALUES (UUID(), 'test_scrum', 'test-scrum', 'pmassist_t_test_scrum', '623722fc-27e1-4222-934e-2d6816dffa84', 1, 0, NOW(), NOW());
UPDATE pmassist.users SET organization_id = (SELECT id FROM pmassist.organizations WHERE slug = 'test-scrum') WHERE id = '623722fc-27e1-4222-934e-2d6816dffa84' AND organization_id IS NULL;

-- ichanna
INSERT IGNORE INTO pmassist.organizations (id, name, slug, db_name, owner_user_id, is_active, is_provisioned, created_at, updated_at)
VALUES (UUID(), 'ichanna', 'ichanna', 'pmassist_t_ichanna', '7d34de82-5660-41c1-9af3-f7491ca259b2', 1, 0, NOW(), NOW());
UPDATE pmassist.users SET organization_id = (SELECT id FROM pmassist.organizations WHERE slug = 'ichanna') WHERE id = '7d34de82-5660-41c1-9af3-f7491ca259b2' AND organization_id IS NULL;

-- test_exec
INSERT IGNORE INTO pmassist.organizations (id, name, slug, db_name, owner_user_id, is_active, is_provisioned, created_at, updated_at)
VALUES (UUID(), 'test_exec', 'test-exec', 'pmassist_t_test_exec', '7f9eedb5-8888-42ad-8f6d-52dbfb0652de', 1, 0, NOW(), NOW());
UPDATE pmassist.users SET organization_id = (SELECT id FROM pmassist.organizations WHERE slug = 'test-exec') WHERE id = '7f9eedb5-8888-42ad-8f6d-52dbfb0652de' AND organization_id IS NULL;

-- test_risk
INSERT IGNORE INTO pmassist.organizations (id, name, slug, db_name, owner_user_id, is_active, is_provisioned, created_at, updated_at)
VALUES (UUID(), 'test_risk', 'test-risk', 'pmassist_t_test_risk', '8619c9ff-4be9-4f15-ab5e-50899e9b0ebf', 1, 0, NOW(), NOW());
UPDATE pmassist.users SET organization_id = (SELECT id FROM pmassist.organizations WHERE slug = 'test-risk') WHERE id = '8619c9ff-4be9-4f15-ab5e-50899e9b0ebf' AND organization_id IS NULL;

-- sumantab
INSERT IGNORE INTO pmassist.organizations (id, name, slug, db_name, owner_user_id, is_active, is_provisioned, created_at, updated_at)
VALUES (UUID(), 'sumantab', 'sumantab', 'pmassist_t_sumantab', 'f16174fd-5dee-4709-8f0e-d3db06649e8f', 1, 0, NOW(), NOW());
UPDATE pmassist.users SET organization_id = (SELECT id FROM pmassist.organizations WHERE slug = 'sumantab') WHERE id = 'f16174fd-5dee-4709-8f0e-d3db06649e8f' AND organization_id IS NULL;

-- ============================================================
-- Step 3: Create tenant databases
-- ============================================================
CREATE DATABASE IF NOT EXISTS pmassist_t_test_org CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS pmassist_t_george_jones CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS pmassist_t_gerogebailoo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS pmassist_t_test_finance CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS pmassist_t_kpbcma CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS pmassist_t_test_pm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS pmassist_t_manjot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS pmassist_t_test_scrum CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS pmassist_t_ichanna CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS pmassist_t_test_exec CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS pmassist_t_test_risk CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS pmassist_t_sumantab CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Grant access
GRANT ALL PRIVILEGES ON `pmassist_t_gerogebailoo`.* TO 'pmuser'@'localhost';
GRANT ALL PRIVILEGES ON `pmassist_t_test_finance`.* TO 'pmuser'@'localhost';
GRANT ALL PRIVILEGES ON `pmassist_t_kpbcma`.* TO 'pmuser'@'localhost';
GRANT ALL PRIVILEGES ON `pmassist_t_test_pm`.* TO 'pmuser'@'localhost';
GRANT ALL PRIVILEGES ON `pmassist_t_manjot`.* TO 'pmuser'@'localhost';
GRANT ALL PRIVILEGES ON `pmassist_t_test_scrum`.* TO 'pmuser'@'localhost';
GRANT ALL PRIVILEGES ON `pmassist_t_ichanna`.* TO 'pmuser'@'localhost';
GRANT ALL PRIVILEGES ON `pmassist_t_test_exec`.* TO 'pmuser'@'localhost';
GRANT ALL PRIVILEGES ON `pmassist_t_test_risk`.* TO 'pmuser'@'localhost';
GRANT ALL PRIVILEGES ON `pmassist_t_sumantab`.* TO 'pmuser'@'localhost';
FLUSH PRIVILEGES;
