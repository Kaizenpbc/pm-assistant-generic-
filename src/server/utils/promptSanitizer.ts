/**
 * Defense-in-depth sanitizer for user-supplied data interpolated into AI prompts.
 *
 * Strips common prompt injection patterns while preserving legitimate project content.
 * This is NOT a guarantee against all injection — it's a mitigation layer.
 */

const DEFAULT_MAX_LENGTH = 50_000;

/** Patterns that look like prompt template markers */
const TEMPLATE_MARKER_RE = /\{\{|\}\}|<<[^>]*>>/g;

/**
 * Line-level injection patterns (case-insensitive).
 * Each regex is tested against individual lines; matching lines are removed entirely.
 */
const INJECTION_LINE_PATTERNS: RegExp[] = [
  /^\s*(SYSTEM|INSTRUCTION|IMPORTANT)\s*:/i,
  /ignore\s+(all\s+|your\s+)?(previous\s+|prior\s+|above\s+)?instructions/i,
  /you\s+are\s+now\b/i,
  /your\s+new\s+(role|task|instructions)\b/i,
  /\bHuman\s*:/,
  /\bAssistant\s*:/,
  /\b(BEGIN|END)\s+SYSTEM\s+(PROMPT|MESSAGE)\b/i,
  /\bdo\s+not\s+follow\s+(any\s+)?(previous|prior|above)\b/i,
  /\boverride\s+(all\s+)?(previous|prior|system)\b/i,
];

/**
 * Sanitize a string before interpolating it into an AI prompt.
 *
 * - Strips template marker sequences (`{{`, `}}`, `<<...>>`)
 * - Removes lines matching common injection patterns
 * - Truncates to `maxLength` characters
 * - Returns empty string for null/undefined input
 */
export function sanitizeForPrompt(input: unknown, maxLength: number = DEFAULT_MAX_LENGTH): string {
  if (input == null) return '';
  let text = String(input);

  // Strip template markers
  text = text.replace(TEMPLATE_MARKER_RE, '');

  // Remove injection lines
  const lines = text.split('\n');
  const filtered = lines.filter(line => {
    return !INJECTION_LINE_PATTERNS.some(pattern => pattern.test(line));
  });
  text = filtered.join('\n');

  // Truncate
  if (text.length > maxLength) {
    text = text.slice(0, maxLength) + '\n... [truncated]';
  }

  return text;
}
