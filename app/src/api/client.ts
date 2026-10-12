import { Platform } from 'react-native';
import { getToken } from '@/auth/tokenStorage';
import { APP_VERSION, PLATFORM } from '@/lib/appInfo';
import { getLang } from '@/lib/i18n';
import { markOnline } from '@/lib/online';

/**
 * Web in development: call /api on the app's own address; Metro forwards it to
 * Laravel (see metro.config.js). Phones and production builds use EXPO_PUBLIC_API_URL.
 */
export const API_URL =
  Platform.OS === 'web' && __DEV__ && typeof window !== 'undefined'
    ? `${window.location.origin}/api`
    : (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api').replace(/\/$/, '');

/** An error from the API, with Laravel's validation messages when there are any. */
export class ApiError extends Error {
  status: number;
  errors: Record<string, string[]>;
  /** The whole error body, e.g. { attempts_left: 2 } or { locked: true, retry_after: 540 }. */
  data: Record<string, unknown>;

  constructor(status: number, message: string, errors: Record<string, string[]> = {}, data: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.errors = errors;
    this.data = data;
  }

  /** True when the server couldn't be reached at all. */
  get offline(): boolean {
    return this.status === 0;
  }

  /** The first validation message, or the general message. */
  get firstMessage(): string {
    const first = Object.values(this.errors)[0]?.[0];
    return first ?? this.message;
  }
}

let onUnauthorized: (() => void) | null = null;

let onSuspended: ((message: string) => void) | null = null;

/** Called when the school is paused: the person is signed out with the reason. */
export function setSuspendedHandler(handler: (message: string) => void) {
  onSuspended = handler;
}

/** The auth store registers this so an expired token logs the user out. */
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export async function api<T>(path: string, options: { method?: Method; body?: unknown; token?: string | null; raw?: boolean } = {}): Promise<T> {
  const token = options.token !== undefined ? options.token : await getToken();

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: options.raw ? 'text/csv, application/json' : 'application/json',
        'X-Lang': getLang(),
        'X-App-Version': APP_VERSION,
        'X-Platform': PLATFORM,
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    markOnline(false);
    throw new ApiError(0, `Can't reach the TeachWise server at ${API_URL}. Check that it is running and on the same network.`);
  }
  markOnline(true);

  const text = await response.text();
  const data = text ? safeJson(text) : null;

  if (!response.ok) {
    if (response.status === 401 && token) {
      onUnauthorized?.();
    }
    if (response.status === 403 && data && typeof data === 'object' && (data as { school_suspended?: boolean }).school_suspended) {
      onSuspended?.(String((data as { message?: string }).message ?? 'Your school’s account is paused.'));
    }
    const body = (data && typeof data === 'object' ? data : {}) as { message?: unknown; errors?: Record<string, string[]> };
    const message =
      typeof body.message === 'string' && body.message
        ? body.message
        : response.status === 429
          ? 'Too many attempts. Please wait a minute and try again.'
          : `Something went wrong (${response.status}).`;
    const errors = body.errors ?? {};
    throw new ApiError(response.status, message, errors, body as Record<string, unknown>);
  }

  return (options.raw ? text : data) as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Uploads a file (multipart) to the API, e.g. the school logo. Same errors as api(). */
export async function apiUpload<T>(path: string, field: string, file: Blob, filename: string): Promise<T> {
  const token = await getToken();
  const form = new FormData();
  form.append(field, file as Blob, filename);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'X-Lang': getLang(), 'X-App-Version': APP_VERSION, 'X-Platform': PLATFORM, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: form,
    });
  } catch {
    markOnline(false);
    throw new ApiError(0, 'Can’t reach the TeachWise server.');
  }
  const text = await response.text();
  const data = text ? safeJson(text) : null;
  if (!response.ok) {
    const body = (data && typeof data === 'object' ? data : {}) as { message?: string; errors?: Record<string, string[]> };
    throw new ApiError(response.status, body.message ?? `Upload failed (${response.status}).`, body.errors ?? {}, body as Record<string, unknown>);
  }
  return data as T;
}
