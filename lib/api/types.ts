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
  role: Role
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
  productName: string | null
  serviceId: string
  serviceName: string
  serviceCategory: string
  isBundle: boolean
  /** Legacy single value, null on anything logged since variations landed. */
  complexity: Complexity | null
  /** The tiers actually present, in variation order. */
  complexities: Complexity[]
  /**
   * Whether the first variation is the parent listing (§2.4).
   *
   * False when the delivery shipped for child SKUs only. Optional because the
   * ledger list does not send it — only the detail and the priced rows do.
   */
  hasParentLine?: boolean
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
  /**
   * Its own quotable code, derived from the delivery's (§2.5).
   *
   *   WX-2026-0043     the service against the parent listing
   *   WX-2026-0043-1   its first child product
   */
  code: string
  complexity: Complexity
  /** The CHILD product this variation shipped for, by name. */
  productName: string | null
  /** Its own listing code. Null on everything logged before 2026-08-31. */
  asinCode: string | null
  /** This variation's own ClickUp task. */
  clickupTaskId: string | null
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
  /**
   * The tier, or null for none — which the server stores as STANDALONE, the
   * plain version of the service rather than a fourth degree of complexity.
   */
  complexity: Complexity | null
  /** The CHILD product this variation shipped for, by name, under the parent. */
  productName?: string | null
  /** This variation's own ClickUp task. */
  clickupTaskId?: string | null
  /**
   * Becomes that many real revision_round records on this variation, each
   * classified against the agency's snapshotted allowance.
   *
   * Optional since the logging form stopped asking (§5.1): the server defaults
   * it to 0, so a delivery starts with no rounds and gains them on its own
   * record. Still accepted, so nothing that already sends it breaks.
   */
  revisionCount?: number
  notes?: string | null
}

/** One delivered service within a submission, with its own variations. */
export type DeliveryLinePayload = {
  serviceId: string
  /**
   * Whether the first variation below is the parent listing. Defaults true
   * server-side, which is what every delivery logged before this was.
   */
  hasParentLine?: boolean
  /** The ClickUp task for this service. */
  clickupTaskId?: string | null
  /** At least one. variationCount is derived from this, never typed separately. */
  variations: VariationPayload[]
}

/** One product listing and everything shipped for it. */
export type AsinPayload = {
  /** The PARENT listing. Optional: a delivery with no code has no ASIN attached. */
  code?: string | null
  /** What the product is called, for anyone reading the ledger later. */
  productName?: string | null
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
  /** Who delivered it, by name. Created on save if this person is new. */
  deliveredByName?: string
  /** Older shape: a login account's id. One of the two is required. */
  deliveredById?: string
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

/**
 * Two roles since 2026-08-28 (§5.10).
 *
 * OWNER and VIEWER were removed: the owner is an admin, and a read-only account
 * nobody had asked for was one more role to keep every gate in step with.
 */
export type Role = 'ADMIN' | 'PM'

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

/** The ledger's totals, aggregated in the database over the active filters. */
export type TaskSummary = {
  totals: {
    deliveries: number
    variations: number
    revisionRounds: number
    roundsBeyondAllowance: number
  }
  byAgency: {
    agencyId: string
    agencyName: string
    deliveries: number
    variations: number
    revisionRounds: number
    roundsBeyondAllowance: number
  }[]
  byComplexity: {
    complexity: Complexity
    variations: number
    revisionRounds: number
    roundsBeyondAllowance: number
  }[]
}

/** A service and what an admin says each of its tiers is worth (minor units). */
export type ServiceRateRow = {
  serviceId: string
  serviceName: string
  category: string
  active: boolean
  tiers: {
    complexity: Complexity
    hasRate: boolean
    perVariationMinor: number
    perExtraRevisionMinor: number
  }[]
  updatedAt: string | null
}

/**
 * One agency's rates for one service.
 *
 * Null is not zero: it means this tier is not priced for this agency, and the
 * pricing screen names it rather than charging nothing for it. There is no
 * house card behind these — it was removed on 2026-08-27.
 */
export type AgencyRateRow = {
  serviceId: string
  serviceName: string
  category: string
  active: boolean
  tiers: {
    complexity: Complexity
    hasOverride: boolean
    perVariationMinor: number | null
    perExtraRevisionMinor: number | null
  }[]
  /** How many of the four tiers this agency has priced. */
  overriddenTiers: number
}

/** What shipped in a date range, priced by service. */
/** How the priced rollup is bucketed. */
export type PricingGroupBy = 'agency' | 'brand' | 'service' | 'tier'

/** One bucket of the rollup: whatever it is grouped by, the shape is the same. */
export type PricingLine = {
  key: string
  label: string
  /** Context the label alone lacks — a brand's agency, a service's category. */
  sublabel: string | null
  deliveries: number
  variations: number
  extraRounds: number
  variationsMinor: number
  revisionsMinor: number
  totalMinor: number
  unpricedVariations: number
  missingTiers: string[]
}

/** A delivery from the ledger, priced. Identity columns, then money. */
export type PricedDelivery = {
  taskId: string
  taskCode: string
  /** Whether the first line is the parent listing (§2.4). */
  hasParentLine?: boolean
  deliveredOn: string
  agencyId: string
  agencyName: string
  agencyType: string
  brandId: string
  brandName: string
  asinCode: string | null
  productName: string | null
  serviceId: string
  serviceName: string
  isBundle: boolean
  /** Whoever is named as having delivered it. */
  delivererName: string | null
  variations: number
  tiers: Complexity[]
  allowanceSnapshot: number
  extraRounds: number
  variationsMinor: number
  revisionsMinor: number
  totalMinor: number
  /** Variations on this row delivered at a tier with no rate. Never priced as zero. */
  unpricedVariations: number
  /** The per-variation arithmetic behind totalMinor. */
  lines: PricedLine[]
}

/** One variation's contribution to a delivery's price, with the rate used. */
export type PricedLine = {
  variationNumber: number
  /** The variation's own code, so a priced line can be quoted (§2.5). */
  code: string
  productName: string | null
  complexity: Complexity | null
  rounds: number
  /** Rounds past the allowance snapshotted on the delivery. */
  paidRounds: number
  /** The rate actually applied, so the arithmetic can be checked. Null if none. */
  perVariationMinor: number | null
  perExtraRevisionMinor: number | null
  variationMinor: number
  revisionsMinor: number
  totalMinor: number
  priced: boolean
}

export type PricingSummary = {
  from: string
  to: string
  groupBy: PricingGroupBy
  lines: PricingLine[]
  deliveries: PricedDelivery[]
  totals: {
    deliveries: number
    variations: number
    extraRounds: number
    variationsMinor: number
    revisionsMinor: number
    totalMinor: number
    unpricedVariations: number
  }
  /** Service and tier combinations delivered with no rate set. */
  gaps: { serviceId: string; serviceName: string; variations: number; tiers: string[] }[]
}

/** One entry in the notification centre, derived from an audit_log row. */
export type Notification = {
  id: string
  kind: 'delivery' | 'revision' | 'pricing' | 'admin'
  entity: string
  entityId: string
  action: string
  actorName: string
  title: string
  detail: string | null
  createdAt: string
  unread: boolean
  /** Only a task has somewhere to go; the rest are statements, not links. */
  href: string | null
}

export type NotificationFeed = {
  /** When this person last opened the panel. Null means never. */
  seenAt: string | null
  /** When they last cleared it. Entries older than this are hidden from them. */
  clearedAt: string | null
  entries: Notification[]
}

// ------------------------------------------------------------ team reports

/** A person on the Team list, with their login account when they have one. */
export type AdminDeliverer = {
  id: string
  name: string
  taskCount: number
  /** Null for the many Team members who never sign in (§5.5). */
  account: { email: string; role: Role; active: boolean } | null
}


/**
 * One person's delivery record (§5.5).
 *
 * No money on it. What someone's work was worth is a Pricing question, and the
 * Pricing screen already filters by person — an amount here would be the ledger
 * carrying a price, which §1 forbids.
 */
export type DelivererReport = {
  person: {
    id: string
    name: string
    active: boolean
    addedOn: string
    account: {
      email: string
      role: Role
      active: boolean
      createdAt: string
      lastSeenAt: string | null
      /** Set while a run of failed sign-ins has the account locked (§5.10). */
      lockedUntil: string | null
    } | null
  }
  totals: {
    deliveries: number
    variations: number
    revisionRounds: number
    roundsBeyondAllowance: number
    edits: number
  }
  byAgency: { id: string; name: string; deliveries: number; variations: number }[]
  byService: { id: string; name: string; deliveries: number; variations: number }[]
  recent: {
    id: string
    taskCode: string
    deliveredOn: string
    agencyName: string
    brandName: string
    serviceName: string
    variationCount: number
    revisionRoundCount: number
    roundsBeyondAllowance: number
  }[]
}
