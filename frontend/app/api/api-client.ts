export interface ApiErrorBody {
  statusCode?: number;
  error?: string;
  message?: string | string[];
  requestId?: string;
  path?: string;
  timestamp?: string;
}

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly error: string,
    message: string | string[],
    readonly requestId?: string,
    readonly path?: string,
  ) {
    super(Array.isArray(message) ? message.join(' ') : message);
    this.name = 'ApiError';
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export async function apiRequest<T>(
  path: string,
  accessToken: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  if (!path.startsWith('/api/') || path.startsWith('//')) {
    throw new Error('API requests must use a same-origin /api path');
  }

  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  headers.set('Authorization', `Bearer ${accessToken}`);

  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.body);
  }

  const response = await fetch(path, {
    ...options,
    body,
    credentials: 'same-origin',
    headers,
  });

  if (response.status === 204) return undefined as T;

  const payload = await readJson(response);
  if (!response.ok) {
    const errorBody = payload as ApiErrorBody | undefined;
    throw new ApiError(
      response.status,
      errorBody?.error ?? 'Request failed',
      errorBody?.message ?? `The request failed with status ${response.status}.`,
      errorBody?.requestId,
      errorBody?.path,
    );
  }

  return payload as T;
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.headers.get('content-type')?.includes('application/json')) return undefined;
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const message = error.message || fallback;
    return error.requestId ? `${message} (Reference: ${error.requestId})` : message;
  }
  if (error instanceof TypeError) return fallback;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
