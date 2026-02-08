/**
 * Converts a snake_case string to camelCase.
 * Idempotent: strings already in camelCase pass through unchanged.
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());
}

/**
 * Recursively converts all object keys from snake_case to camelCase.
 * Handles objects, arrays, nested structures, null, undefined, primitives, and Date.
 * Only converts keys — values are left untouched.
 */
export function toCamelCaseKeys<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => toCamelCaseKeys(item)) as T;
  }

  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    result[snakeToCamel(key)] = toCamelCaseKeys((obj as Record<string, unknown>)[key]);
  }
  return result as T;
}
