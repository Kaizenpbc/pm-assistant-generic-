/**
 * Database Migration Script
 *
 * Creates all 21 tables for the PM Assistant application.
 * All statements are idempotent (CREATE TABLE IF NOT EXISTS).
 * No foreign key constraints — the app handles referential integrity.
 *
 * Usage:
 *   npx tsx src/server/database/migrate.ts
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';

const DB_CONFIG = {
  host: process.env['DB_HOST'] || 'localhost',
  port: Number(process.env['DB_PORT'] || 3306),
  user: process.env['DB_USER'] || 'root',
  password: process.env['DB_PASSWORD'] || 'rootpassword',
  database: process.env['DB_NAME'] || 'pm_assistant_generic',
  multipleStatements: true,
};

// ---------------------------------------------------------------------------
// Table definitions (order respects dependencies)
// ---------------------------------------------------------------------------

const TABLES: string[] = [
  // ── Tier 1: No dependencies ──────────────────────────────────────────────

  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role ENUM('admin','pmo_manager','portfolio_manager','pm') NOT NULL DEFAULT 'pm',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_username (username),
    INDEX idx_users_email (email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS portfolios (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by VARCHAR(36) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_portfolios_active (is_active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS user_portfolio_assignments (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    portfolio_id VARCHAR(36) NOT NULL,
    assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_upa_user (user_id),
    INDEX idx_upa_portfolio (portfolio_id),
    UNIQUE INDEX idx_upa_user_portfolio (user_id, portfolio_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS project_templates (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    project_type ENUM('it','construction','infrastructure','roads','other') NOT NULL DEFAULT 'other',
    category VARCHAR(100) NOT NULL DEFAULT 'custom',
    is_built_in BOOLEAN NOT NULL DEFAULT FALSE,
    created_by VARCHAR(36) DEFAULT NULL,
    estimated_duration_days INT NOT NULL DEFAULT 30,
    tasks JSON NOT NULL,
    tags JSON NOT NULL DEFAULT ('[]'),
    usage_count INT NOT NULL DEFAULT 0,
    INDEX idx_templates_type (project_type),
    INDEX idx_templates_category (category)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS resources (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    capacity_hours_per_week INT NOT NULL DEFAULT 40,
    skills JSON NOT NULL DEFAULT ('[]'),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    INDEX idx_resources_email (email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS workflow_rules (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    trigger_config JSON NOT NULL,
    action_config JSON NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // ── Tier 2: Depend on tier 1 ─────────────────────────────────────────────

  `CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    project_type ENUM('it','construction','infrastructure','roads','other') NOT NULL DEFAULT 'other',
    status ENUM('planning','active','on_hold','completed','cancelled') NOT NULL DEFAULT 'planning',
    priority ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
    budget_allocated DECIMAL(15,2) DEFAULT NULL,
    budget_spent DECIMAL(15,2) NOT NULL DEFAULT 0,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    location VARCHAR(255),
    location_lat DECIMAL(10,6) DEFAULT NULL,
    location_lon DECIMAL(10,6) DEFAULT NULL,
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL,
    project_manager_id VARCHAR(36) DEFAULT NULL,
    portfolio_id VARCHAR(36) DEFAULT NULL,
    created_by VARCHAR(36) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_projects_status (status),
    INDEX idx_projects_created_by (created_by),
    INDEX idx_projects_type (project_type),
    INDEX idx_projects_portfolio (portfolio_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS chat_conversations (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    project_id VARCHAR(36) DEFAULT NULL,
    context_type VARCHAR(50) NOT NULL DEFAULT 'general',
    title VARCHAR(255) NOT NULL,
    messages JSON NOT NULL DEFAULT ('[]'),
    token_count INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_chat_user (user_id),
    INDEX idx_chat_active (is_active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS audit_events (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    user_id VARCHAR(36) DEFAULT NULL,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    details JSON NOT NULL DEFAULT ('{}'),
    ip VARCHAR(45) DEFAULT NULL,
    user_agent TEXT,
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_timestamp (timestamp)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // ── Tier 3: Depend on tier 2 ─────────────────────────────────────────────

  `CREATE TABLE IF NOT EXISTS project_members (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role ENUM('owner','manager','editor','viewer') NOT NULL DEFAULT 'viewer',
    added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pm_project (project_id),
    INDEX idx_pm_user (user_id),
    UNIQUE INDEX idx_pm_project_user (project_id, user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS schedules (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status ENUM('pending','active','completed','on_hold','cancelled') NOT NULL DEFAULT 'active',
    created_by VARCHAR(36) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_schedules_project (project_id),
    INDEX idx_schedules_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS lessons_learned (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL,
    project_name VARCHAR(255) NOT NULL,
    project_type VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    impact ENUM('positive','negative','neutral') NOT NULL,
    recommendation TEXT NOT NULL,
    confidence INT NOT NULL DEFAULT 50,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ll_project (project_id),
    INDEX idx_ll_category (category),
    INDEX idx_ll_type (project_type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS patterns (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    frequency INT NOT NULL DEFAULT 0,
    project_types JSON NOT NULL DEFAULT ('[]'),
    category VARCHAR(50) NOT NULL,
    recommendation TEXT NOT NULL,
    confidence INT NOT NULL DEFAULT 50
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // ── Tier 4: Depend on tier 3 ─────────────────────────────────────────────

  `CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    schedule_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status ENUM('pending','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending',
    priority ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
    assigned_to VARCHAR(36) DEFAULT NULL,
    due_date DATE DEFAULT NULL,
    estimated_days INT DEFAULT NULL,
    estimated_duration_hours DECIMAL(8,2) DEFAULT NULL,
    actual_duration_hours DECIMAL(8,2) DEFAULT NULL,
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL,
    progress_percentage INT NOT NULL DEFAULT 0,
    dependency VARCHAR(36) DEFAULT NULL,
    dependency_type ENUM('FS','SS','FF','SF') DEFAULT NULL,
    risks TEXT,
    issues TEXT,
    comments TEXT,
    parent_task_id VARCHAR(36) DEFAULT NULL,
    created_by VARCHAR(36) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tasks_schedule (schedule_id),
    INDEX idx_tasks_status (status),
    INDEX idx_tasks_dependency (dependency),
    INDEX idx_tasks_parent (parent_task_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS baselines (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    schedule_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(36) NOT NULL,
    tasks JSON NOT NULL,
    INDEX idx_baselines_schedule (schedule_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS reschedule_proposals (
    id VARCHAR(64) NOT NULL PRIMARY KEY,
    schedule_id VARCHAR(36) NOT NULL,
    status ENUM('pending','accepted','rejected','modified') NOT NULL DEFAULT 'pending',
    delayed_tasks JSON NOT NULL,
    proposed_changes JSON NOT NULL,
    rationale TEXT NOT NULL,
    estimated_impact JSON NOT NULL,
    feedback TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_rp_schedule (schedule_id),
    INDEX idx_rp_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS meeting_analyses (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL,
    schedule_id VARCHAR(36) NOT NULL,
    transcript MEDIUMTEXT NOT NULL,
    summary TEXT NOT NULL,
    action_items JSON NOT NULL DEFAULT ('[]'),
    decisions JSON NOT NULL DEFAULT ('[]'),
    risks JSON NOT NULL DEFAULT ('[]'),
    task_updates JSON NOT NULL DEFAULT ('[]'),
    applied_items JSON NOT NULL DEFAULT ('[]'),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ma_project (project_id),
    INDEX idx_ma_schedule (schedule_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  // ── Tier 5: Depend on tier 4 ─────────────────────────────────────────────

  `CREATE TABLE IF NOT EXISTS task_comments (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    task_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    text TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tc_task (task_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS task_activities (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    task_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    field VARCHAR(100) DEFAULT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ta_task (task_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS resource_assignments (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    resource_id VARCHAR(36) NOT NULL,
    task_id VARCHAR(36) NOT NULL,
    schedule_id VARCHAR(36) NOT NULL,
    hours_per_week INT NOT NULL DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    INDEX idx_ra_resource (resource_id),
    INDEX idx_ra_task (task_id),
    INDEX idx_ra_schedule (schedule_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS workflow_executions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rule_id VARCHAR(36) NOT NULL,
    rule_name VARCHAR(255) NOT NULL,
    task_id VARCHAR(36) NOT NULL,
    task_name VARCHAR(255) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    result TEXT NOT NULL,
    executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_we_rule (rule_id),
    INDEX idx_we_task (task_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function migrate() {
  console.log('Starting database migration...');
  console.log(`Connecting to ${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`);

  let connection: mysql.Connection | null = null;

  try {
    // First ensure the database exists
    const rootConnection = await mysql.createConnection({
      host: DB_CONFIG.host,
      port: DB_CONFIG.port,
      user: DB_CONFIG.user,
      password: DB_CONFIG.password,
    });

    await rootConnection.execute(
      `CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await rootConnection.end();

    // Now connect to the database and create tables
    connection = await mysql.createConnection(DB_CONFIG);

    for (let i = 0; i < TABLES.length; i++) {
      const sql = TABLES[i];
      // Extract table name from CREATE TABLE statement
      const match = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
      const tableName = match ? match[1] : `table_${i + 1}`;

      try {
        await connection.execute(sql);
        console.log(`  ✓ ${tableName}`);
      } catch (err) {
        console.error(`  ✗ ${tableName}: ${err instanceof Error ? err.message : err}`);
        throw err;
      }
    }

    // ── Post-creation ALTER statements (idempotent) ─────────────────────────
    // These handle upgrading existing tables that were created before the
    // hierarchical role model was introduced.

    const ALTERS: { description: string; sql: string }[] = [
      {
        description: 'users.role → new ENUM (admin, pmo_manager, portfolio_manager, pm)',
        sql: `ALTER TABLE users MODIFY COLUMN role ENUM('admin','pmo_manager','portfolio_manager','pm') NOT NULL DEFAULT 'pm'`,
      },
      {
        description: 'projects.portfolio_id column',
        sql: `ALTER TABLE projects ADD COLUMN portfolio_id VARCHAR(36) DEFAULT NULL`,
      },
      {
        description: 'projects.portfolio_id index',
        sql: `ALTER TABLE projects ADD INDEX idx_projects_portfolio (portfolio_id)`,
      },
    ];

    for (const alter of ALTERS) {
      try {
        await connection.execute(alter.sql);
        console.log(`  ✓ ALTER: ${alter.description}`);
      } catch (err: unknown) {
        const code = (err as { code?: string }).code;
        // ER_DUP_FIELDNAME (1060) = column already exists
        // ER_DUP_KEYNAME (1061) = index already exists
        if (code === 'ER_DUP_FIELDNAME' || code === 'ER_DUP_KEYNAME') {
          console.log(`  · ALTER: ${alter.description} (already applied)`);
        } else {
          console.error(`  ✗ ALTER: ${alter.description}: ${err instanceof Error ? err.message : err}`);
          throw err;
        }
      }
    }

    console.log(`\nMigration complete — ${TABLES.length} tables created/verified.`);
  } catch (err) {
    console.error('\nMigration failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

migrate();
