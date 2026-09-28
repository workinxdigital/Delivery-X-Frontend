import type { Complexity } from '@/lib/api/types'

/**
 * One variation of a delivered service: the child product it shipped for, and
 * the tier it was delivered at.
 *
 * This file used to hold a VariationRows component that drew its own grid. The
 * rows are now cells in the services table in asin-section, which is what gives
 * the columns a shared alignment; only the shape and its empty value are shared.
 */
export type VariationDraft = {
  /**
   * Low, Medium, High — or nothing.
   *
   * Empty is not "unfilled", it is an answer: the plain version of the service,
   * which prices at its standalone base rate. So the form never insists on one.
   */
  complexity: Complexity | ''
  /**
   * The CHILD product this variation shipped for, by name.
   *
   * The parent ASIN sits on the card header; each variation is one SKU under it
   * — "KP Duty 30ml" under "KP Duty". A name rather than a code, because the
   * name is what a person recognises. Optional: not knowing it must never block
   * recording that the work went out.
   */
  productName: string
  /**
   * The child's own ASIN, optional (owner, 2026-08-31).
   *
   * A variation is one SKU and a SKU has its own listing code, so recording it
   * makes "which ASIN did this go on" answerable at the child level rather than
   * only the parent's. The NAME still identifies it on screen; this is an
   * addition, not a replacement.
   */
  asinCode: string
}

/*
 * No ClickUp id and no revision count here any more (owner, 2026-09-01).
 *
 * Both were per-variation fields on the logging form and both left it: a
 * delivery is logged at the moment it ships, and neither is known then. Rounds
 * happen afterwards and are added on the delivery's own record, one at a time,
 * with their own dates — which is what the revision timeline was always for.
 * The columns and the API still carry both, so nothing logged before this
 * changed and either can come back without a migration.
 */
export const emptyVariation = (): VariationDraft => ({
  complexity: '',
  productName: '',
  asinCode: '',
})
