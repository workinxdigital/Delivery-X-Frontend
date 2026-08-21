/**
 * Typed client for the DeliverX API.
 *
 * Every request sends credentials, because auth will be a session cookie
 * rather than a bearer token and the browser must be told to include it on a
 * cross-origin request. Errors are unwrapped from the API's envelope so
 * callers get a real Error, and field-level validation issues survive so the
 * form can show them inline.
 */
import type {
  Agency,
  Brand,
  CreateTaskPayload,
  CreateTaskResult,
  DuplicateWarning,
  Service,
  Task,
  TaskFilters,
  TaskListResult,
  User,
} from './types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

export type ValidationIssue = { path: string; message: string }

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly issues: ValidationIssue[] = [],
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

type ApiErrorBody = {
  error?: { code?: string; message?: string; issues?: ValidationIssue[] }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiErrorBody
    throw new ApiError(
      res.status,
      body.error?.code ?? 'UNKNOWN',
      body.error?.message ?? `Request failed with ${res.status}`,
      body.error?.issues ?? [],
    )
  }

  return res.json() as Promise<T>
}

function qs(params: Record<string, unknown>): string {
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    search.set(k, String(v))
  }
  const s = search.toString()
  return s ? `?${s}` : ''
}

// ---------------------------------------------------------------- reference

export const getAgencies = () =>
  apiFetch<{ agencies: Agency[] }>('/agencies').then((r) => r.agencies)

export const getServices = () =>
  apiFetch<{ services: Service[] }>('/services').then((r) => r.services)

export const getUsers = () => apiFetch<{ users: User[] }>('/users').then((r) => r.users)

export const getBrands = (agencyId: string, q?: string) =>
  apiFetch<{ brands: Brand[] }>(`/brands${qs({ agencyId, q })}`).then((r) => r.brands)

// ---------------------------------------------------------------- tasks

export const getTasks = (filters: TaskFilters) =>
  apiFetch<TaskListResult>(`/tasks${qs(filters)}`)

export const getTask = (id: string) =>
  apiFetch<{ task: Task }>(`/tasks/${id}`).then((r) => r.task)

export const createTask = (payload: CreateTaskPayload) =>
  apiFetch<CreateTaskResult>('/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const checkDuplicate = (params: {
  agencyId: string
  brandName: string
  serviceId: string
  complexity: string
  deliveredOn: string
}) =>
  apiFetch<{ duplicate: DuplicateWarning }>(`/tasks/duplicate-check${qs(params)}`).then(
    (r) => r.duplicate,
  )

/** The export URL, so the browser can download it directly with filters applied. */
export const exportCsvUrl = (filters: TaskFilters) =>
  `${BASE_URL}/tasks/export.csv${qs(filters)}`

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
