-- MCP tool invocation logging for external access analytics
CREATE TABLE IF NOT EXISTS mcp_tool_invocations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) DEFAULT NULL,
  api_key_id VARCHAR(36) DEFAULT NULL,
  session_id VARCHAR(64) DEFAULT NULL,
  tool_name VARCHAR(128) NOT NULL,
  duration_ms INT UNSIGNED DEFAULT NULL,
  is_success TINYINT(1) NOT NULL DEFAULT 1,
  error_message TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_mcp_inv_user_created (user_id, created_at),
  INDEX idx_mcp_inv_tool_created (tool_name, created_at),
  INDEX idx_mcp_inv_apikey_created (api_key_id, created_at),
  INDEX idx_mcp_inv_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
