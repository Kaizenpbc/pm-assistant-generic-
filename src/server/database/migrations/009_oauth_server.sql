-- OAuth 2.1 server tables for MCP per-user authentication
-- Supports dynamic client registration, authorization codes with PKCE, and token management

CREATE TABLE IF NOT EXISTS oauth_clients (
  client_id VARCHAR(255) NOT NULL PRIMARY KEY,
  client_secret VARCHAR(255) DEFAULT NULL,
  client_secret_expires_at BIGINT DEFAULT NULL,
  client_id_issued_at BIGINT DEFAULT NULL,
  redirect_uris JSON NOT NULL,
  client_name VARCHAR(255) DEFAULT NULL,
  client_uri VARCHAR(2048) DEFAULT NULL,
  logo_uri VARCHAR(2048) DEFAULT NULL,
  scope TEXT DEFAULT NULL,
  contacts JSON DEFAULT NULL,
  tos_uri VARCHAR(2048) DEFAULT NULL,
  policy_uri VARCHAR(2048) DEFAULT NULL,
  token_endpoint_auth_method VARCHAR(50) DEFAULT 'none',
  grant_types JSON DEFAULT NULL,
  response_types JSON DEFAULT NULL,
  software_id VARCHAR(255) DEFAULT NULL,
  software_version VARCHAR(50) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS oauth_auth_codes (
  code VARCHAR(128) NOT NULL PRIMARY KEY,
  client_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  redirect_uri VARCHAR(2048) NOT NULL,
  code_challenge VARCHAR(128) NOT NULL,
  code_challenge_method VARCHAR(10) NOT NULL DEFAULT 'S256',
  scope TEXT DEFAULT NULL,
  state VARCHAR(255) DEFAULT NULL,
  expires_at TIMESTAMP NOT NULL,
  consumed TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_oauth_auth_codes_client (client_id),
  INDEX idx_oauth_auth_codes_expires (expires_at),
  FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  client_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  api_key_id VARCHAR(36) NOT NULL,
  access_token_hash VARCHAR(64) NOT NULL,
  refresh_token VARCHAR(128) DEFAULT NULL,
  refresh_token_expires_at TIMESTAMP NULL DEFAULT NULL,
  scope TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked TINYINT(1) NOT NULL DEFAULT 0,
  INDEX idx_oauth_tokens_access (access_token_hash),
  INDEX idx_oauth_tokens_refresh (refresh_token),
  INDEX idx_oauth_tokens_client (client_id),
  INDEX idx_oauth_tokens_user (user_id),
  FOREIGN KEY (client_id) REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
