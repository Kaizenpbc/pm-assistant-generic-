const API_KEY = process.env.PM_API_KEY;
const BASE_URL = (process.env.PM_BASE_URL || 'https://pm.kpbc.ca').replace(/\/$/, '');

if (!API_KEY) {
  console.error('PM_API_KEY environment variable is required');
  process.exit(1);
}

async function request(method: string, path: string, body?: unknown): Promise<unknown> {
  const url = `${BASE_URL}/api/v1${path}`;
  const reqHeaders: Record<string, string> = {
    'Authorization': `Bearer ${API_KEY!}`,
  };
  if (body !== undefined) {
    reqHeaders['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, {
    method,
    headers: reqHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  get: (path: string) => request('GET', path),
  post: (path: string, body?: unknown) => request('POST', path, body),
  put: (path: string, body?: unknown) => request('PUT', path, body),
  delete: (path: string) => request('DELETE', path),
};

export function jsonResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}
