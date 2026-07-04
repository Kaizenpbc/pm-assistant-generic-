#!/usr/bin/env node
/**
 * Migration CLI — run, rollback, dry-run, or list migrations.
 *
 * Usage:
 *   npx ts-node src/server/database/migrateCli.ts run          # Apply pending migrations
 *   npx ts-node src/server/database/migrateCli.ts run --dry-run # Preview pending migrations
 *   npx ts-node src/server/database/migrateCli.ts rollback      # Rollback last migration
 *   npx ts-node src/server/database/migrateCli.ts rollback 3    # Rollback last 3 migrations
 *   npx ts-node src/server/database/migrateCli.ts rollback --dry-run  # Preview rollback
 *   npx ts-node src/server/database/migrateCli.ts list          # List all migrations + status
 *
 * Environment: Requires DB_HOST, DB_USER, DB_PASSWORD, DB_NAME (or defaults from config).
 */

import { runMigrations, rollbackMigrations, dryRunMigrations, listMigrations } from './migrationRunner';
import { databaseService } from './connection';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'run';
  const isDryRun = args.includes('--dry-run');

  try {
    switch (command) {
      case 'run':
        if (isDryRun) {
          await dryRunMigrations();
        } else {
          await runMigrations();
        }
        break;

      case 'rollback': {
        const countArg = args.find(a => /^\d+$/.test(a));
        const count = countArg ? parseInt(countArg, 10) : 1;
        await rollbackMigrations(count, isDryRun);
        break;
      }

      case 'list':
        await listMigrations();
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.error('Usage: migrateCli.ts [run|rollback|list] [--dry-run] [count]');
        process.exit(1);
    }
  } catch (error) {
    console.error('Migration failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await databaseService.close();
  }
}

main();
