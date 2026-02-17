/**
 * Database Migration Runner
 *
 * Usage:
 *   npx tsx src/server/database/migrate.ts          # Apply pending migrations
 *   npx tsx src/server/database/migrate.ts --status  # Show migration status
 *   npx tsx src/server/database/migrate.ts --reset   # Drop all tables and re-apply (DESTRUCTIVE!)
 *
 * Migrations are .sql files in src/server/database/migrations/ and are applied
 * in alphabetical order. Each migration is tracked in the `_migrations` table.
 */

import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

// Inline config to avoid side-effects of importing the full config module
const dbConfig = {
  host: process.env['DB_HOST'] || 'localhost',
  port: parseInt(process.env['DB_PORT'] || '3306', 10),
  user: process.env['DB_USER'] || 'root',
  password: process.env['DB_PASSWORD'] || 'rootpassword',
  database: process.env['DB_NAME'] || 'pm_assistant_generic',
  multipleStatements: true,
};

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureMigrationsTable(pool: mysql.Pool): Promise<void> {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      name        VARCHAR(255) NOT NULL UNIQUE,
      applied_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function getAppliedMigrations(pool: mysql.Pool): Promise<Set<string>> {
  const [rows] = await pool.execute('SELECT name FROM _migrations ORDER BY id');
  return new Set((rows as any[]).map(r => r.name));
}

function getMigrationFiles(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
}

async function applyMigration(pool: mysql.Pool, fileName: string): Promise<void> {
  const filePath = path.join(MIGRATIONS_DIR, fileName);
  const sql = fs.readFileSync(filePath, 'utf8');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(sql);
    await connection.execute('INSERT INTO _migrations (name) VALUES (?)', [fileName]);
    await connection.commit();
    console.log(`  [OK] ${fileName}`);
  } catch (err) {
    await connection.rollback();
    console.error(`  [FAIL] ${fileName}:`, (err as Error).message);
    throw err;
  } finally {
    connection.release();
  }
}

async function showStatus(pool: mysql.Pool): Promise<void> {
  const applied = await getAppliedMigrations(pool);
  const files = getMigrationFiles();

  console.log('\nMigration Status:');
  console.log('─'.repeat(60));
  for (const f of files) {
    const status = applied.has(f) ? '\x1b[32m[applied]\x1b[0m' : '\x1b[33m[pending]\x1b[0m';
    console.log(`  ${status}  ${f}`);
  }
  const pending = files.filter(f => !applied.has(f));
  console.log(`\n  ${applied.size} applied, ${pending.length} pending\n`);
}

async function resetDatabase(pool: mysql.Pool): Promise<void> {
  console.log('\n\x1b[31mRESETTING DATABASE — dropping all tables!\x1b[0m\n');
  const connection = await pool.getConnection();
  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    const [tables] = await connection.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = ?`,
      [dbConfig.database],
    );
    for (const row of tables as any[]) {
      await connection.query(`DROP TABLE IF EXISTS \`${row.table_name}\``);
      console.log(`  Dropped: ${row.table_name}`);
    }
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    connection.release();
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isStatus = args.includes('--status');
  const isReset = args.includes('--reset');

  // Create database if it doesn't exist
  const { database, ...noDbConfig } = dbConfig;
  const initPool = mysql.createPool({ ...noDbConfig, multipleStatements: true });
  try {
    await initPool.execute(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
  } finally {
    await initPool.end();
  }

  const pool = mysql.createPool(dbConfig);

  try {
    if (isReset) {
      await resetDatabase(pool);
    }

    await ensureMigrationsTable(pool);

    if (isStatus) {
      await showStatus(pool);
      return;
    }

    const applied = await getAppliedMigrations(pool);
    const files = getMigrationFiles();
    const pending = files.filter(f => !applied.has(f));

    if (pending.length === 0) {
      console.log('\nAll migrations are up to date.\n');
      return;
    }

    console.log(`\nApplying ${pending.length} migration(s)...\n`);
    for (const file of pending) {
      await applyMigration(pool, file);
    }
    console.log('\nDone.\n');
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
