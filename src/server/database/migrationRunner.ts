import fs from 'fs';
import path from 'path';
import { databaseService } from './connection';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

/**
 * Known historical duplicate numeric prefixes.
 * These files are already applied in production and cannot be renamed (immutable).
 * - 002: 002_auth_and_subscriptions.sql + 002_seed_agent_policies.sql
 * - 003: 003_agent_autonomy.sql + 003_notifications_and_proposals.sql
 * Any NEW duplicate prefix will cause the runner to fail fast.
 */
const KNOWN_DUPLICATE_PREFIXES = new Set([2, 3]);

/** Parse the leading numeric prefix from a migration filename (e.g. "002_foo.sql" -> 2). */
export function parseMigrationNumber(filename: string): number {
  const match = filename.match(/^(\d+)/);
  if (!match) throw new Error(`Migration file "${filename}" has no numeric prefix`);
  return parseInt(match[1], 10);
}

/**
 * Validate migration files: detect duplicate numeric prefixes (excluding known historical ones).
 * Returns files sorted deterministically by (number, then filename).
 */
export function validateAndSortMigrations(files: string[]): string[] {
  const byNumber = new Map<number, string[]>();

  for (const file of files) {
    const num = parseMigrationNumber(file);
    const existing = byNumber.get(num) || [];
    existing.push(file);
    byNumber.set(num, existing);
  }

  // Detect NEW duplicate prefixes (not in the known allowlist)
  const errors: string[] = [];
  for (const [num, group] of byNumber) {
    if (group.length > 1 && !KNOWN_DUPLICATE_PREFIXES.has(num)) {
      errors.push(`  Prefix ${String(num).padStart(3, '0')}: ${group.join(', ')}`);
    }
  }
  if (errors.length > 0) {
    throw new Error(
      `Duplicate migration numbers detected (not in known allowlist):\n${errors.join('\n')}\n` +
      `Fix: use unique sequential numbers for new migrations.`
    );
  }

  // Sort deterministically: by numeric prefix first, then by filename for tiebreak
  return [...files].sort((a, b) => {
    const numA = parseMigrationNumber(a);
    const numB = parseMigrationNumber(b);
    if (numA !== numB) return numA - numB;
    return a.localeCompare(b);
  });
}

export async function runMigrations(): Promise<void> {
  // Ensure _migrations tracking table exists
  await databaseService.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Get already-applied migrations
  const applied = await databaseService.query<{ name: string }>(
    'SELECT name FROM _migrations ORDER BY name'
  );
  const appliedSet = new Set(applied.map(r => r.name));

  // Read migration files, validate, and sort deterministically
  const rawFiles = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql'));
  const files = validateAndSortMigrations(rawFiles);

  // Log known duplicate warnings
  for (const num of KNOWN_DUPLICATE_PREFIXES) {
    const group = files.filter(f => parseMigrationNumber(f) === num);
    if (group.length > 1) {
      console.log(`[migration] Note: prefix ${String(num).padStart(3, '0')} has known historical duplicates: ${group.join(', ')}`);
    }
  }

  let ranCount = 0;

  for (const file of files) {
    if (appliedSet.has(file)) continue;

    const num = parseMigrationNumber(file);
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf-8').trim();
    if (!sql) continue;

    console.log(`[migration] Running #${String(num).padStart(3, '0')}: ${file}`);

    // Split on semicolons to execute statements individually
    // (mysql2 execute doesn't support multi-statement by default)
    const statements = sql
      .split(/;\s*$/m)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    const connection = await databaseService.getConnection();
    try {
      await connection.beginTransaction();

      for (const stmt of statements) {
        await connection.query(stmt);
      }

      // Record migration as applied (INSERT IGNORE to handle files that self-insert)
      await connection.query(
        'INSERT IGNORE INTO _migrations (name) VALUES (?)',
        [file]
      );

      await connection.commit();
      console.log(`[migration] Applied #${String(num).padStart(3, '0')}: ${file} (${statements.length} statements)`);
      ranCount++;
    } catch (error) {
      await connection.rollback();
      console.error(`[migration] FAILED #${String(num).padStart(3, '0')}: ${file}`, error);
      throw error; // Stop on first failure
    } finally {
      connection.release();
    }
  }

  if (ranCount === 0) {
    console.log('[migration] All migrations already applied');
  } else {
    console.log(`[migration] Completed: ${ranCount} migration(s) applied`);
  }
}
