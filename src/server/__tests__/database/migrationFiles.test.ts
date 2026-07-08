import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// Mock database connection to avoid config validation in test env
vi.mock('../../database/connection', () => ({
  databaseService: { query: vi.fn(), getConnection: vi.fn() },
}));

import { parseMigrationNumber, validateAndSortMigrations } from '../../database/migrationRunner';

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'database', 'migrations');

/**
 * Known historical duplicate numeric prefixes that are already applied in production.
 * These cannot be renamed (immutable). Any NEW duplicate should fail this test.
 */
const KNOWN_DUPLICATE_PREFIXES = new Set([2, 3]);

describe('Migration file integrity', () => {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql') && !f.endsWith('.down.sql'));

  it('all migration files have numeric prefixes', () => {
    for (const file of files) {
      expect(() => parseMigrationNumber(file)).not.toThrow();
    }
  });

  it('no NEW duplicate numeric prefixes (excludes known historical: 002, 003)', () => {
    const byNumber = new Map<number, string[]>();
    for (const file of files) {
      const num = parseMigrationNumber(file);
      const group = byNumber.get(num) || [];
      group.push(file);
      byNumber.set(num, group);
    }

    const newDuplicates: string[] = [];
    for (const [num, group] of byNumber) {
      if (group.length > 1 && !KNOWN_DUPLICATE_PREFIXES.has(num)) {
        newDuplicates.push(`Prefix ${String(num).padStart(3, '0')}: ${group.join(', ')}`);
      }
    }

    expect(newDuplicates).toEqual([]);
  });

  it('validateAndSortMigrations returns deterministic order', () => {
    const sorted = validateAndSortMigrations(files);
    expect(sorted.length).toBe(files.length);

    // Verify numeric order is monotonically non-decreasing
    for (let i = 1; i < sorted.length; i++) {
      const prevNum = parseMigrationNumber(sorted[i - 1]);
      const currNum = parseMigrationNumber(sorted[i]);
      expect(currNum).toBeGreaterThanOrEqual(prevNum);

      // Within same prefix, alphabetical tiebreak
      if (currNum === prevNum) {
        expect(sorted[i].localeCompare(sorted[i - 1])).toBeGreaterThan(0);
      }
    }
  });

  it('validateAndSortMigrations rejects unknown duplicate prefixes', () => {
    const testFiles = ['050_foo.sql', '050_bar.sql', '051_baz.sql'];
    expect(() => validateAndSortMigrations(testFiles)).toThrow(/Duplicate migration numbers/);
  });

  it('validateAndSortMigrations allows known duplicate prefixes', () => {
    const testFiles = ['002_a.sql', '002_b.sql', '003_a.sql', '003_b.sql', '004_c.sql'];
    expect(() => validateAndSortMigrations(testFiles)).not.toThrow();
  });
});

describe('SQL statement parsing (comment handling)', () => {
  // Replicate the parsing logic used in runMigrations
  function parseStatements(sql: string): string[] {
    return sql
      .split(/;\s*$/m)
      .map(s => s.split('\n').filter(line => !line.trimStart().startsWith('--')).join('\n').trim())
      .filter(s => s.length > 0);
  }

  it('parses a single statement with a leading comment', () => {
    const sql = '-- Migration 042: Add cost_rate_hourly\nALTER TABLE resources ADD COLUMN cost_rate_hourly DECIMAL(10,2);\n';
    const stmts = parseStatements(sql);
    expect(stmts).toHaveLength(1);
    expect(stmts[0]).toBe('ALTER TABLE resources ADD COLUMN cost_rate_hourly DECIMAL(10,2)');
  });

  it('parses multiple statements with interleaved comments', () => {
    const sql = [
      '-- Step 1',
      'CREATE TABLE foo (id INT);',
      '',
      '-- Step 2',
      'ALTER TABLE foo ADD COLUMN bar VARCHAR(50);',
    ].join('\n');
    const stmts = parseStatements(sql);
    expect(stmts).toHaveLength(2);
    expect(stmts[0]).toContain('CREATE TABLE foo');
    expect(stmts[1]).toContain('ALTER TABLE foo');
  });

  it('handles comment-only files gracefully', () => {
    const sql = '-- This migration is intentionally blank\n-- Nothing to do\n';
    const stmts = parseStatements(sql);
    expect(stmts).toHaveLength(0);
  });

  it('handles inline content after -- only strips full-line comments', () => {
    const sql = "INSERT INTO config (key, val) VALUES ('mode', 'fast'); -- default\n";
    const stmts = parseStatements(sql);
    // The line doesn't START with --, so it should be kept intact
    expect(stmts).toHaveLength(1);
    expect(stmts[0]).toContain("INSERT INTO config");
  });
});
