// lib/api.ts — typed fetch wrapper with error classes

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Property not found') {
    super(404, message);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends ApiError {
  retryAfter: number;
  constructor(retryAfter = 60) {
    super(429, 'Too many requests. Please try again later.');
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: HeadersInit = { ...options?.headers };
  // Only set Content-Type for JSON — let the browser handle FormData, etc.
  if (!(options?.body instanceof FormData)) {
    (headers as Record<string, string>)['Content-Type'] ??= 'application/json';
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    if (res.status === 404) throw new NotFoundError();
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '60', 10);
      throw new RateLimitError(retryAfter);
    }
    const body = await res.text().catch(() => '');
    throw new ApiError(res.status, body || `Request failed: ${res.status}`);
  }

  return res.json();
}
