const TOKEN_KEY = 'aitodo_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  if (!(init.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, {
    ...init,
    headers,
    credentials: 'include',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error || `请求失败 (${res.status})`) as Error & {
      status?: number;
      code?: string;
    };
    err.status = res.status;
    err.code = (data as { code?: string }).code;
    throw err;
  }
  return data as T;
}
