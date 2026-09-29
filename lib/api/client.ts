/**
 * Typed client for the DeliverX API.
 *
 * Every request sends credentials, because auth is a session cookie rather than
 * a bearer token. Errors are unwrapped from the API's envelope so callers get a
 * real Error, and field-level validation issues survive so the form can show
 * them inline.
 */
import type {
  Role,
  AdminDeliverer,
  DelivererReport,
  AddRevisionRoundPayload,
  Agency,
  Brand,
  CreateTaskPayload,
  CreateTaskResult,
  DuplicateWarning,
  RevisionReason,
  Service,
  Task,
  TaskDetail,
  TaskFilters,
  TaskSummary,
  AdminAgency,
  AdminService,
  NotificationFeed,
  PricingSummary,
  PricingGroupBy,
  ServiceRateRow,
  AgencyRateRow,
  AdminUser,
  SessionUser,
  TaskListResult,
  UpdateTaskPayload,
  UpdateTaskResult,
  HistoryEntry,
  User,
} from './types'

/**
 * The API is reached through this app's own origin.
 *
 * Not the API's hostname: the two deployments are separate sites, so calling it
 * directly made the session cookie a third-party cookie, which Safari blocks
 * outright and Chrome restricts. The app worked in whichever browser it was set
 * up in and showed blank screens on other devices, because those requests
 * arrived with no session attached.
 *
 * next.config.ts proxies /api/v1/* to the real API, so every request here is
 * same-origin: the cookie is first-party, there is no preflight, and the
 * API's address stays a server-side detail rather than something baked into the
 * JavaScript every visitor downloads.
 */
const BASE_URL = '/api/v1'

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

// ---------------------------------------------------------- notifications

export const getNotifications = (limit = 40) =>
  apiFetch<NotificationFeed>(`/notifications${qs({ limit })}`)

export const getUnreadCount = () =>
  apiFetch<{ unread: number }>('/notifications/unread-count').then((r) => r.unread)

/**
 * Clear this person's panel.
 *
 * Not a delete: audit_log is append-first (§4.2), so this moves their floor and
 * hides older entries from their feed alone. Everyone else's is untouched.
 */
export const clearNotifications = () =>
  apiFetch<{ clearedAt: string; seenAt: string }>('/notifications/clear', { method: 'POST' })

export const markNotificationsSeen = () =>
  apiFetch<{ seenAt: string }>('/notifications/seen', { method: 'POST' })

export const getAgencies = () =>
  apiFetch<{ agencies: Agency[] }>('/agencies').then((r) => r.agencies)

/**
 * Active services, which is what the logging form should offer.
 * Pass true for filter dropdowns: a retired service still needs to be selectable
 * to find the deliveries logged against it before it was retired.
 */
export const getServices = (includeInactive = false) =>
  apiFetch<{ services: Service[] }>(
    `/services${includeInactive ? '?includeInactive=true' : ''}`,
  ).then((r) => r.services)

export const getUsers = () => apiFetch<{ users: User[] }>('/users').then((r) => r.users)

export const getBrands = (agencyId: string, q?: string) =>
  apiFetch<{ brands: Brand[] }>(`/brands${qs({ agencyId, q })}`).then((r) => r.brands)

/** The team, for the "delivered by" field. Anyone typed there joins this list. */
export const getDeliverers = () =>
  apiFetch<{ deliverers: { id: string; name: string; taskCount: number }[] }>(
    '/deliverers',
  ).then((r) => r.deliverers)

/** ASINs already used for a brand, for the logging form's autocomplete. */
export const getAsins = (brandId: string, q?: string) =>
  apiFetch<{
    asins: { id: string; code: string; productName: string | null; taskCount: number }[]
  }>(
    `/asins${qs({ brandId, q })}`,
  ).then((r) => r.asins)

// ---------------------------------------------------------------- tasks

export const getTasks = (filters: TaskFilters) =>
  apiFetch<TaskListResult>(`/tasks${qs(filters)}`)

/** Totals over the same filters the ledger has applied. */
export const getTaskSummary = (filters: TaskFilters) =>
  apiFetch<TaskSummary>(`/tasks/summary${qs(filters)}`)

export const getTask = (id: string) =>
  apiFetch<{ task: TaskDetail }>(`/tasks/${id}`).then((r) => r.task)

export const getRevisionReasons = () =>
  apiFetch<{ reasons: RevisionReason[] }>('/revision-reasons').then((r) => r.reasons)

/** Rounds hang off a variation, since that is what they now belong to. */
export const addRevisionRound = (variationId: string, payload: AddRevisionRoundPayload) =>
  apiFetch<{
    round: { id: string; roundNumber: number; beyondAllowance: boolean }
    variationNumber: number
    variation: { revisionRoundCount: number; roundsBeyondAllowance: number }
    delivery: {
      variationCount: number
      totalRounds: number
      roundsBeyondAllowancePerVariation: number
      roundsBeyondAllowancePerDelivery: number
    }
    allowanceInForce: number
  }>(`/variations/${variationId}/revision-rounds`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const createTask = (payload: CreateTaskPayload) =>
  apiFetch<CreateTaskResult>('/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const updateTask = (id: string, payload: UpdateTaskPayload) =>
  apiFetch<UpdateTaskResult>(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

/** Soft delete: the row stops appearing but is never removed (§4.2). */
export const deleteTask = (id: string, reason?: string | null) =>
  apiFetch<{ removed: { id: string; taskCode: string; deletedAt: string } }>(
    `/tasks/${id}`,
    { method: 'DELETE', body: JSON.stringify({ reason: reason ?? null }) },
  )

export const getTaskHistory = (id: string) =>
  apiFetch<{ history: HistoryEntry[] }>(`/tasks/${id}/history`).then((r) => r.history)

export const checkDuplicate = (params: {
  agencyId: string
  brandName: string
  serviceId: string
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

// ---------------------------------------------------------------- auth

export const loginRequest = (email: string, password: string) =>
  apiFetch<{ user: SessionUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }).then((r) => r.user)

export const logoutRequest = () => apiFetch<{ ok: true }>('/auth/logout', { method: 'POST' })

/** Change your own password. Any role; the current password is required. */
export const changePassword = (currentPassword: string, newPassword: string) =>
  apiFetch<{ ok: true; otherSessionsEnded: number }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })

/** Throws ApiError with status 401 when there is no session. */
export const getMe = () => apiFetch<{ user: SessionUser }>('/auth/me').then((r) => r.user)

// ---------------------------------------------------------------- admin

export const getAdminAgencies = () =>
  apiFetch<{ agencies: AdminAgency[] }>('/admin/agencies').then((r) => r.agencies)

export const createAgency = (payload: Partial<AdminAgency>) =>
  apiFetch<{ agency: AdminAgency }>('/admin/agencies', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const updateAgency = (id: string, payload: Partial<AdminAgency>) =>
  apiFetch<{ agency: AdminAgency }>(`/admin/agencies/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

/**
 * `force` takes the agency's deliveries and brands with it.
 *
 * Without it the API refuses to remove an agency that has deliveries, since
 * they would be left naming something the admin screen says is gone. Everything
 * is soft-deleted either way, so a forced delete is recoverable in the database.
 */
export const deleteAgency = (id: string, force = false) =>
  apiFetch<{
    removed: { id: string; name: string; tasksRemoved: number; brandsRemoved: number }
  }>(`/admin/agencies/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ force }),
  })

// ---------------------------------------------------------------- pricing

export const getServiceRates = () =>
  apiFetch<{ services: ServiceRateRow[] }>('/admin/service-rates').then((r) => r.services)

/**
 * One agency's rate card (owner, 2026-08-27).
 *
 * A blank amount here means "use the house rate", not zero — which is the whole
 * difference between this and the house card, where a blank is refused.
 */
export const getAgencyRates = (agencyId: string) =>
  apiFetch<{ agencyId: string; agencyName: string; services: AgencyRateRow[] }>(
    `/admin/agencies/${agencyId}/rates`,
  )

export const saveAgencyRate = (
  agencyId: string,
  payload: {
    serviceId: string
    tiers: { complexity: string; perVariation: string; perExtraRevision: string }[]
  },
) =>
  apiFetch<{ ok: true }>(`/admin/agencies/${agencyId}/rates`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })

export const saveServiceRate = (payload: {
  serviceId: string
  tiers: { complexity: string; perVariation: string; perExtraRevision: string }[]
}) =>
  apiFetch<{ ok: true }>('/admin/service-rates', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })

/**
 * What one delivery was worth, for the breakdown on its own record.
 *
 * The same server pass as the Pricing screen, narrowed to one task — so the
 * figures on a task record and the row on Pricing are one arithmetic. The date
 * range is the delivery's own day, since that is all this needs to cover.
 */
export const getTaskPricing = (taskId: string, deliveredOn: string) =>
  apiFetch<PricingSummary>(
    `/admin/pricing${qs({ from: deliveredOn, to: deliveredOn, groupBy: 'agency', taskId })}`,
  ).then((r) => r.deliveries[0] ?? null)

export const getPricing = (params: {
  from: string
  to: string
  groupBy?: PricingGroupBy
  agencyId?: string
  delivererId?: string
  /** One delivery, for a statement covering a single project (§5.7). */
  taskId?: string
  /** Only jobs with rounds past the allowance, or only those without. */
  paidRounds?: 'with' | 'without'
}) => apiFetch<PricingSummary>(`/admin/pricing${qs(params)}`)

// ---------------------------------------------------------------- periods

/** A calendar month, what it holds, and whether it is closed (§5.6). */
export type AdminPeriod = {
  id: string
  periodStart: string
  periodEnd: string
  status: 'OPEN' | 'LOCKED'
  lockedAt: string | null
  deliveries: number
  variations: number
  revisionRounds: number
  roundsBeyondAllowance: number
  agencies: number
}

export const getAdminPeriods = () =>
  apiFetch<{ periods: AdminPeriod[] }>('/admin/periods').then((r) => r.periods)

export const setPeriodLock = (id: string, lock: boolean) =>
  apiFetch<{ period: AdminPeriod }>(`/admin/periods/${id}/lock`, {
    method: 'POST',
    body: JSON.stringify({ lock }),
  })

// ---------------------------------------------------------------- team

export const getAdminDeliverers = () =>
  apiFetch<{ deliverers: AdminDeliverer[] }>('/admin/deliverers').then((r) => r.deliverers)

/**
 * One person's deliveries and account, for the Team tab (§5.5).
 *
 * The counterpart to the privacy rule: a PM sees only their own work (§5.10),
 * so an admin needs one screen that shows everyone's.
 */
export const getDelivererReport = (id: string, range?: { from?: string; to?: string }) =>
  apiFetch<DelivererReport>(`/admin/deliverers/${encodeURIComponent(id)}/report${qs(range ?? {})}`)

/**
 * Add someone to the Team, optionally with a login.
 *
 * The login is opt-in because most of this list never signs in (§5.5). The
 * mailbox and password travel; the DOMAIN does not — the server appends its own
 * constant and drops anything after an `@`, so no request can create an account
 * on a domain the company does not own. It returns the address and the password
 * so the admin can pass them on; the password is never stored in the clear.
 */
export const createDeliverer = (
  name: string,
  /**
   * Omit for a Team entry with no account. The mailbox and password are
   * optional inside it — the server falls back to deriving both from the name.
   */
  login?: { emailLocal?: string; password?: string },
) =>
  apiFetch<{
    deliverer: { id: string; name: string; created: boolean }
    account: { id: string; email: string; role: Role; password: string } | null
  }>('/admin/deliverers', {
    method: 'POST',
    body: JSON.stringify({ name, createLogin: Boolean(login), ...login }),
  })

/**
 * Edit a person: their Team name, and their account when they have one.
 *
 * One request because the Team tab treats those as one person. The domain is
 * not sent — only the mailbox — and the server appends its own constant, the
 * same as on creation. Omitted fields are left alone.
 */
export const updateDeliverer = (
  id: string,
  patch: { name?: string; emailLocal?: string; password?: string; active?: boolean },
) =>
  apiFetch<{ deliverer: { id: string; name: string } }>(
    `/admin/deliverers/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
  )

/** Soft delete: the name stops being offered, and its deliveries keep it. */
export const deleteDeliverer = (id: string) =>
  apiFetch<{ removed: { id: string; name: string; keptDeliveries: number } }>(
    `/admin/deliverers/${id}`,
    { method: 'DELETE' },
  )

export const getAdminServices = () =>
  apiFetch<{ services: AdminService[] }>('/admin/services').then((r) => r.services)

export const createService = (payload: Partial<AdminService>) =>
  apiFetch<{ service: AdminService }>('/admin/services', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const updateService = (id: string, payload: Partial<AdminService>) =>
  apiFetch<{ service: AdminService }>(`/admin/services/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

export const deleteService = (id: string) =>
  apiFetch<{ removed: { id: string; name: string } }>(`/admin/services/${id}`, {
    method: 'DELETE',
  })

export const getAdminUsers = () =>
  apiFetch<{ users: AdminUser[] }>('/admin/users').then((r) => r.users)

export const createUser = (payload: {
  name: string
  email: string
  role: string
  password: string
}) =>
  apiFetch<{ user: AdminUser }>('/admin/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const updateUser = (
  id: string,
  payload: { name?: string; email?: string; role?: string; active?: boolean; password?: string },
) =>
  apiFetch<{ user: AdminUser }>(`/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
