import fs from 'fs';
import path from 'path';
import { databaseService } from './connection';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

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

  // Read migration files and sort by name (numeric prefix)
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let ranCount = 0;

  for (const file of files) {
    if (appliedSet.has(file)) continue;

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf-8').trim();
    if (!sql) continue;

    console.log(`[migration] Running: ${file}`);

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

      await connection.query(
        'INSERT INTO _migrations (name) VALUES (?)',
        [file]
      );

      await connection.commit();
      console.log(`[migration] Applied: ${file} (${statements.length} statements)`);
      ranCount++;
    } catch (error) {
      await connection.rollback();
      console.error(`[migration] FAILED: ${file}`, error);
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
