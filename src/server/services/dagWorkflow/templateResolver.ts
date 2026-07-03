import { Task } from '../ScheduleService';

/**
 * Replace `{{source.path}}` patterns in an input object with runtime values.
 * - `{{task.field}}` → value from the triggering task
 * - `{{nodes.<nodeId>.path}}` → value from a previous node's output
 * If the entire string is a single template, the resolved type is preserved.
 * Mixed strings do string interpolation. Unresolved templates remain as-is.
 */
export function resolveTemplates(
  input: Record<string, any>,
  nodeOutputs: Record<string, any>,
  task: Task | null,
): Record<string, any> {
  const clone = JSON.parse(JSON.stringify(input));

  function resolvePath(source: Record<string, any> | null, path: string[]): any {
    if (!source) return undefined;
    let current: any = source;
    for (const key of path) {
      if (current == null || typeof current !== 'object') return undefined;
      current = current[key];
    }
    return current;
  }

  function resolveToken(token: string): any {
    if (token.startsWith('task.')) {
      return resolvePath(task as any, token.slice(5).split('.'));
    }
    if (token.startsWith('nodes.')) {
      const parts = token.slice(6).split('.');
      const nodeId = parts[0];
      return resolvePath(nodeOutputs[nodeId] ?? null, parts.slice(1));
    }
    return undefined;
  }

  function walk(obj: any): any {
    if (typeof obj === 'string') {
      const singleMatch = obj.match(/^\{\{(.+?)\}\}$/);
      if (singleMatch) {
        const resolved = resolveToken(singleMatch[1]);
        return resolved !== undefined ? resolved : obj;
      }
      return obj.replace(/\{\{(.+?)\}\}/g, (full: string, token: string) => {
        const resolved = resolveToken(token);
        return resolved !== undefined ? String(resolved) : full;
      });
    }
    if (Array.isArray(obj)) return obj.map(walk);
    if (obj && typeof obj === 'object') {
      for (const key of Object.keys(obj)) {
        obj[key] = walk(obj[key]);
      }
    }
    return obj;
  }

  return walk(clone);
}
