/**
 * Typed fetch wrapper for the Express API.
 *
 * Every call sends credentials, because auth is a session cookie rather than
 * a bearer token — the browser has to be told to include it on a cross-origin
 * request. Errors are unwrapped from the API's standard envelope so callers
 * get a real Error rather than having to inspect a response body.
 */
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

type ApiErrorBody = { error?: { code?: string; message?: string } }

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiErrorBody
    throw new ApiError(
      res.status,
      body.error?.code ?? 'UNKNOWN',
      body.error?.message ?? `Request failed with ${res.status}`,
    )
  }

  return res.json() as Promise<T>
}

export type HealthResponse = {
  ok: boolean
  service: string
  time: string
  domain: { resolved: boolean; sample: string }
  database?:
    | { status: 'connected'; tables: number; services: number; agencies: number; tasks: number }
    | { status: 'unreachable'; error: string }
}

export const getHealth = () => apiFetch<HealthResponse>('/health')
