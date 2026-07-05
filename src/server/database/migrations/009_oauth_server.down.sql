-- Rollback 009_oauth_server
DROP TABLE IF EXISTS oauth_tokens;
DROP TABLE IF EXISTS oauth_auth_codes;
DROP TABLE IF EXISTS oauth_clients;
