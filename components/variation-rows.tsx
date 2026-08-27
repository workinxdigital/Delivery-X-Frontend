import type { Complexity } from '@/lib/api/types'

/**
 * One variation of a delivered service: its complexity tier and how many
 * revision rounds it took.
 *
 * revisionCount is a string because it is a text input mid-typing — "" and "0"
 * are different states while someone is editing, and coercing early made the
 * field fight the person filling it in.
 *
 * This file used to hold a VariationRows component that drew its own grid. The
 * rows are now cells in the services table in asin-section, which is what gives
 * the columns a shared alignment; only the shape and its empty value are shared.
 */
export type VariationDraft = {
  complexity: Complexity | ''
  revisionCount: string
}

export const emptyVariation = (): VariationDraft => ({ complexity: '', revisionCount: '0' })
