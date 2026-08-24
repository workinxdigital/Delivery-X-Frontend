/**
 * Shapes returned by the DeliverX API.
 *
 * There is no monetary field in any of these, and there never will be
 * (CLAUDE.md §1). The API records counts: variations, revision rounds, edits.
 */
export type Complexity = 'LOW' | 'MEDIUM' | 'HIGH' | 'STANDALONE'
export type TaskStatus = 'DELIVERED' | 'REVISION_IN_PROGRESS' | 'CLOSED'

export type Agency = {
  id: string
  name: string
  type: 'AGENCY' | 'DIRECT'
  freeRevisionAllowance: number
}

export type Service = {
  id: string
  code: string
  name: string
  category: string
  isBundle: boolean
  active: boolean
  sortOrder: number
  /** Populated for bundles so the form can show contents inline (§5.1). */
  components: { id: string; name: string }[]
}

export type User = {
  id: string
  name: string
  email: string
  role: 'OWNER' | 'ADMIN' | 'PM' | 'VIEWER'
}

export type Brand = { id: string; name: string }

export type Task = {
  id: string
  taskCode: string
  /** A date, not a timestamp: 'YYYY-MM-DD'. */
  deliveredOn: string
  agencyId: string
  agencyName: string
  agencyType: 'AGENCY' | 'DIRECT'
  brandId: string
  brandName: string
  asinId: string | null
  asinCode: string | null
  serviceId: string
  serviceName: string
  serviceCategory: string
  isBundle: boolean
  /** Legacy single value, null on anything logged since variations landed. */
  complexity: Complexity | null
  /** The tiers actually present, in variation order. */
  complexities: Complexity[]
  variationCount: number
  variations: TaskVariation[]
  title: string | null
  status: TaskStatus
  revisionRoundCount: number
  /** Sum over variations of that variation's excess. Attributable to rounds. */
  roundsBeyondAllowancePerVariation: number
  /** Total rounds minus one allowance. Arithmetic on the whole delivery. */
  roundsBeyondAllowancePerDelivery: number
  /** The allowance frozen at logging time, not the agency's current setting. */
  freeRevisionAllowanceSnapshot: number
  deliveredById: string
  deliveredByName: string
  loggedByName: string
  editCount: number
  lastEditedAt: string | null
  lastEditedByName: string | null
  clickupTaskId: string | null
  correctsTaskCode: string | null
  periodId: string | null
  periodStatus: 'OPEN' | 'LOCKED' | null
  /** Shared by the rows created in one submission. Null when logged alone. */
  deliveryGroupId: string | null
  notes: string | null
  createdAt: string
}

export type RevisionReason = { id: string; code: string; label: string }

/** One variation of a deliverable, with its own complexity and its own rounds. */
export type TaskVariation = {
  id: string
  variationNumber: number
  complexity: Complexity
  revisionRoundCount: number
  /** Beyond this variation's own allowance. */
  roundsBeyondAllowance: number
}

export type TaskVariationDetail = TaskVariation & {
  notes: string | null
  revisionRounds: RevisionRound[]
}

export type RevisionRound = {
  id: string
  roundNumber: number
  requestedOn: string
  completedOn: string | null
  /** Derived server-side from the allowance snapshotted on the task (§2.6). */
  beyondAllowance: boolean
  reason: string
  notes: string | null
  loggedByName: string
}

/**
 * Omit rather than intersect: `Task & { variations: X[] }` leaves the narrower
 * `TaskVariation[]` from Task in place, so the rounds are invisible to the
 * compiler.
 */
export type TaskDetail = Omit<Task, 'variations'> & {
  variations: TaskVariationDetail[]
}

export type AddRevisionRoundPayload = {
  reasonId: string
  requestedOn: string
  completedOn?: string | null
  notes?: string | null
}

export type VariationPayload = {
  complexity: Complexity
  /**
   * Becomes that many real revision_round records on this variation, each
   * classified against the agency's snapshotted allowance.
   */
  revisionCount: number
  notes?: string | null
}

/** One delivered service within a submission, with its own variations. */
export type DeliveryLinePayload = {
  serviceId: string
  /** At least one. variationCount is derived from this, never typed separately. */
  variations: VariationPayload[]
}

/** One product listing and everything shipped for it. */
export type AsinPayload = {
  /** Optional: a delivery with no code simply has no ASIN attached. */
  code?: string | null
  /** The ClickUp task for this listing — one job is one ClickUp task per ASIN. */
  clickupTaskId?: string | null
  lines: DeliveryLinePayload[]
}

export type CreateTaskPayload = {
  agencyId: string
  brandName: string
  /**
   * The ASINs this job covered, each with its own services. Every ASIN-service
   * pair becomes its own ledger row sharing a delivery group, because one row
   * per delivered service per product is what keeps the delivered count and the
   * service mix exact.
   */
  asins?: AsinPayload[]
  /** Older shape: services with no ASIN level. One of the two is required. */
  lines?: DeliveryLinePayload[]
  title?: string | null
  deliveredOn: string
  deliveredById: string
  clickupTaskId?: string | null
  notes?: string | null
}

export type CreateTaskResult = {
  /** One per delivered service. */
  tasks: Task[]
  deliveryGroupId: string | null
  /** True when the brand did not exist and was created by this save (§2.2). */
  brandCreated: boolean
  variationWarning: string | null
}

export type TaskListResult = {
  tasks: Task[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export type DuplicateWarning = {
  id: string
  taskCode: string
  title: string | null
  createdAt: string
} | null

export type TaskFilters = {
  from?: string
  to?: string
  agencyId?: string
  brandId?: string
  serviceId?: string
  complexity?: Complexity
  deliveredById?: string
  status?: TaskStatus
  edited?: 'yes' | 'no'
  /** Fetch the other services delivered in the same job. */
  deliveryGroupId?: string
  q?: string
  page?: number
  pageSize?: number
  sort?: 'deliveredOn' | 'createdAt' | 'taskCode' | 'variationCount'
  dir?: 'asc' | 'desc'
}

/** A partial edit. An absent field is left alone rather than cleared (§2.7). */
export type UpdateTaskPayload = {
  agencyId?: string
  brandName?: string
  serviceId?: string
  title?: string | null
  deliveredOn?: string
  deliveredById?: string
  status?: TaskStatus
  clickupTaskId?: string | null
  notes?: string | null
  /** Complexity per variation, keyed by variation id. */
  variationComplexity?: Record<string, Complexity>
  /** Optional note explaining the edit, stored on the audit entry. */
  reason?: string | null
}

export type UpdateTaskResult = {
  task: Task | null
  /** False when nothing actually differed: no counter, no history entry. */
  changed: boolean
  editCount: number
  changedFields: string[]
}

export type HistoryEntry = {
  id: string
  action: string
  actorName: string
  reason: string | null
  at: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}

// ---------------------------------------------------------------- auth

export type Role = 'OWNER' | 'ADMIN' | 'PM' | 'VIEWER'

export type SessionUser = { id: string; name: string; email: string; role: Role }

/** Admin views carry usage counts, so master data is never deleted blind. */
export type AdminAgency = {
  id: string
  name: string
  type: 'AGENCY' | 'DIRECT'
  contactName: string | null
  contactEmail: string | null
  freeRevisionAllowance: number
  status: 'ACTIVE' | 'INACTIVE'
  notes: string | null
  taskCount: number
  brandCount: number
}

export type AdminService = {
  id: string
  code: string
  name: string
  category: string
  isBundle: boolean
  active: boolean
  sortOrder: number
  notes: string | null
  taskCount: number
}

export type AdminUser = {
  id: string
  name: string
  email: string
  role: Role
  active: boolean
  loggedCount: number
}
