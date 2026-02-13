/**
 * Shared Database Mock Helper
 *
 * Provides a consistent way to mock the database layer across all test files.
 * Avoids duplicating the same mock setup in every test file.
 *
 * Usage (at the TOP of your test file, before any service imports):
 *
 *   import { mockDatabaseUnhealthy, mockDatabaseHealthy, mockConfig } from '../test-utils/mockDatabase';
 *   mockConfig();           // Mock config to prevent env validation errors
 *   mockDatabaseUnhealthy(); // Force in-memory fallback path
 *
 * Or for DB-path tests:
 *   mockDatabaseHealthy();  // Simulate healthy DB connection
 */

import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// Config Mock
// ---------------------------------------------------------------------------

/**
 * Standard config mock that prevents environment variable validation failures.
 * Call BEFORE any service imports in your test file.
 */
export function mockConfig(overrides: Record<string, unknown> = {}): void {
  vi.mock('../../config', () => ({
    config: {
      AI_ENABLED: false,
      ANTHROPIC_API_KEY: '',
      AI_MODEL: 'claude-sonnet-4-5-20250929',
      AI_TEMPERATURE: 0.3,
      AI_MAX_TOKENS: 4096,
      DB_HOST: 'localhost',
      DB_PORT: 3306,
      DB_USER: 'test',
      DB_PASSWORD: 'test',
      DB_NAME: 'test_db',
      JWT_SECRET: 'test-jwt-secret',
      JWT_REFRESH_SECRET: 'test-jwt-refresh-secret',
      ...overrides,
    },
  }));
}

// ---------------------------------------------------------------------------
// Database Mocks
// ---------------------------------------------------------------------------

/** Mock databaseService as NOT connected — forces in-memory fallback path. */
export function mockDatabaseUnhealthy(): void {
  vi.mock('../../database/connection', () => ({
    databaseService: {
      isHealthy: () => false,
      query: vi.fn(),
      getPool: vi.fn(),
      transaction: vi.fn(),
    },
  }));
}

/** Mock databaseService as connected — for testing the SQL code path. */
export function mockDatabaseHealthy(): {
  mockQuery: ReturnType<typeof vi.fn>;
  mockTransaction: ReturnType<typeof vi.fn>;
  mockGetPool: ReturnType<typeof vi.fn>;
} {
  const mockQuery = vi.fn();
  const mockTransaction = vi.fn();
  const mockGetPool = vi.fn();

  vi.mock('../../database/connection', () => ({
    databaseService: {
      isHealthy: () => true,
      query: mockQuery,
      getPool: mockGetPool,
      transaction: mockTransaction,
    },
  }));

  return { mockQuery, mockTransaction, mockGetPool };
}

// ---------------------------------------------------------------------------
// Service Mock Helpers
// ---------------------------------------------------------------------------

/**
 * Create a mock for a service class with the given method names.
 * Returns an object whose methods are all vi.fn().
 */
export function createServiceMock<T extends string>(
  methodNames: T[],
): Record<T, ReturnType<typeof vi.fn>> {
  const mock: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of methodNames) {
    mock[name] = vi.fn();
  }
  return mock as Record<T, ReturnType<typeof vi.fn>>;
}
