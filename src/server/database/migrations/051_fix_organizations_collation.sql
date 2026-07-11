-- Fix collation mismatch between organizations (utf8mb4_general_ci) and users (utf8mb4_unicode_ci)
-- that causes "Illegal mix of collations" on JOIN queries
ALTER TABLE organizations CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
