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
  serviceId: string
  serviceName: string
  serviceCategory: string
  isBundle: boolean
  complexity: Complexity
  variationCount: number
  title: string
  status: TaskStatus
  revisionRoundCount: number
  roundsBeyondAllowance: number
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
  notes: string | null
  createdAt: string
}

export type CreateTaskPayload = {
  agencyId: string
  brandName: string
  serviceId: string
  complexity: Complexity
  variationCount: number
  title: string
  deliveredOn: string
  deliveredById: string
  clickupTaskId?: string | null
  notes?: string | null
}

export type CreateTaskResult = {
  task: Task
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
  title: string
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
  q?: string
  page?: number
  pageSize?: number
  sort?: 'deliveredOn' | 'createdAt' | 'taskCode' | 'variationCount'
  dir?: 'asc' | 'desc'
}
