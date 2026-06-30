/**
 * Format a date string in the user's timezone using Intl.DateTimeFormat.
 */
export function formatDate(
  dateStr: string | undefined | null,
  timezone = 'UTC',
  format: 'short' | 'long' | 'datetime' = 'short'
): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    const options: Intl.DateTimeFormatOptions = { timeZone: timezone };

    switch (format) {
      case 'short':
        options.month = 'short';
        options.day = 'numeric';
        break;
      case 'long':
        options.year = 'numeric';
        options.month = 'long';
        options.day = 'numeric';
        break;
      case 'datetime':
        options.year = 'numeric';
        options.month = 'short';
        options.day = 'numeric';
        options.hour = '2-digit';
        options.minute = '2-digit';
        break;
    }

    return new Intl.DateTimeFormat('en-US', options).format(d);
  } catch {
    return dateStr;
  }
}

/**
 * Get a list of common IANA timezones for dropdown.
 * Falls back to a hardcoded list if Intl.supportedValuesOf is unavailable.
 */
export function getTimezones(): string[] {
  try {
    if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
      return (Intl as any).supportedValuesOf('timeZone');
    }
  } catch {}
  return [
    'UTC',
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Toronto', 'America/Vancouver', 'America/Edmonton',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin',
    'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata',
    'Australia/Sydney', 'Pacific/Auckland',
  ];
}
