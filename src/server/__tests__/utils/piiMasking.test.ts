import { describe, it, expect } from 'vitest';
import { maskPii } from '../../utils/logger';

describe('maskPii', () => {
  it('masks email addresses', () => {
    const result = maskPii('Send to user@example.com please') as string;
    expect(result).not.toContain('user@example.com');
    expect(result).toContain('u***@e***.com');
  });

  it('masks multiple emails in one string', () => {
    const result = maskPii('From alice@foo.org to bob@bar.net') as string;
    expect(result).not.toContain('alice@foo.org');
    expect(result).not.toContain('bob@bar.net');
    expect(result).toContain('a***@f***.org');
    expect(result).toContain('b***@b***.net');
  });

  it('masks JWT tokens', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiIxMjMifQ.abc123def456ghi789';
    const result = maskPii(`Token: ${jwt}`) as string;
    expect(result).not.toContain(jwt);
    expect(result).toContain('[JWT_REDACTED]');
  });

  it('masks password field values in JSON strings', () => {
    const result = maskPii('{"username":"admin","password":"secret123"}') as string;
    expect(result).not.toContain('secret123');
    expect(result).toContain('"password":"[REDACTED]"');
  });

  it('preserves non-PII strings unchanged', () => {
    const input = 'Project "Highway Construction" status changed to active';
    expect(maskPii(input)).toBe(input);
  });

  it('handles null and undefined', () => {
    expect(maskPii(null)).toBeNull();
    expect(maskPii(undefined)).toBeUndefined();
  });

  it('handles numbers and booleans unchanged', () => {
    expect(maskPii(42)).toBe(42);
    expect(maskPii(true)).toBe(true);
  });

  it('masks PII in nested objects', () => {
    const obj = { user: { email: 'test@domain.com' }, count: 5 };
    const result = maskPii(obj) as Record<string, unknown>;
    expect((result.user as Record<string, unknown>).email).not.toContain('test@domain.com');
    expect(result.count).toBe(5);
  });

  it('masks PII in arrays', () => {
    const arr = ['user@example.com', 'no-pii-here'];
    const result = maskPii(arr) as string[];
    expect(result[0]).not.toContain('user@example.com');
    expect(result[1]).toBe('no-pii-here');
  });

  it('masks PII in Error objects', () => {
    const err = new Error('Failed for user@example.com');
    const result = maskPii(err) as Error;
    expect(result.message).not.toContain('user@example.com');
    expect(result.message).toContain('u***@e***.com');
  });
});
