import { describe, it, expect } from 'vitest';
import { parsePagination, paginationSchema } from '../../schemas/paginationSchema';

describe('paginationSchema', () => {
  describe('parsePagination', () => {
    it('returns defaults when no params provided', () => {
      const result = parsePagination({});
      expect(result).toEqual({ limit: 50, offset: 0 });
    });

    it('parses valid limit and offset', () => {
      const result = parsePagination({ limit: '10', offset: '20' });
      expect(result).toEqual({ limit: 10, offset: 20 });
    });

    it('coerces string numbers', () => {
      const result = parsePagination({ limit: '25', offset: '50' });
      expect(result).toEqual({ limit: 25, offset: 50 });
    });

    it('clamps limit to max 200', () => {
      expect(() => parsePagination({ limit: '300' })).toThrow();
    });

    it('rejects limit below 1', () => {
      expect(() => parsePagination({ limit: '0' })).toThrow();
    });

    it('rejects negative offset', () => {
      expect(() => parsePagination({ offset: '-1' })).toThrow();
    });

    it('accepts limit of 1', () => {
      const result = parsePagination({ limit: '1' });
      expect(result.limit).toBe(1);
    });

    it('accepts limit of 200', () => {
      const result = parsePagination({ limit: '200' });
      expect(result.limit).toBe(200);
    });

    it('accepts offset of 0', () => {
      const result = parsePagination({ offset: '0' });
      expect(result.offset).toBe(0);
    });

    it('accepts large offset', () => {
      const result = parsePagination({ offset: '10000' });
      expect(result.offset).toBe(10000);
    });
  });

  describe('paginationSchema direct', () => {
    it('parses numeric inputs directly', () => {
      const result = paginationSchema.parse({ limit: 5, offset: 10 });
      expect(result).toEqual({ limit: 5, offset: 10 });
    });

    it('rejects non-integer limit', () => {
      expect(() => paginationSchema.parse({ limit: 5.5 })).toThrow();
    });

    it('rejects non-integer offset', () => {
      expect(() => paginationSchema.parse({ offset: 2.7 })).toThrow();
    });
  });
});
