'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { getBrands } from '@/lib/api/client'
import { cn } from '@/lib/utils'

/**
 * The brand field (CLAUDE.md §2.2, §5.1).
 *
 * Free text, not a select — brands are not master data. Suggestions come from
 * brands already used for the selected agency, but anything typed is accepted
 * and the backend creates the brand on save if it is genuinely new.
 *
 * Deliberately NOT a combobox: forcing a selection would put a data-entry
 * blocker in front of the fast path, which is the opposite of the intent.
 */
export function BrandInput({
  agencyId,
  value,
  onChange,
  disabled,
  invalid,
  id,
}: {
  agencyId: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  invalid?: boolean
  id?: string
}) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const { data: brands = [] } = useQuery({
    queryKey: ['brands', agencyId, value],
    queryFn: () => getBrands(agencyId, value || undefined),
    enabled: Boolean(agencyId),
    staleTime: 30_000,
  })

  // Only suggest when the typed text is not already an exact match, so the
  // dropdown does not sit in the way after a selection.
  const suggestions = brands
    .filter((b) => b.name.toLowerCase() !== value.trim().toLowerCase())
    .slice(0, 8)

  const showList = open && suggestions.length > 0

  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [])

  function commit(name: string) {
    onChange(name)
    setOpen(false)
    setHighlight(-1)
  }

  const isNew =
    value.trim().length > 0 &&
    !brands.some((b) => b.name.toLowerCase() === value.trim().toLowerCase())

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        id={id}
        value={value}
        disabled={disabled || !agencyId}
        aria-invalid={invalid}
        autoComplete="off"
        placeholder={agencyId ? 'Type a brand name' : 'Pick an agency first'}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setHighlight(-1)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!showList) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlight((h) => Math.min(h + 1, suggestions.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlight((h) => Math.max(h - 1, -1))
          } else if (e.key === 'Enter' && highlight >= 0) {
            e.preventDefault()
            commit(suggestions[highlight]!.name)
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
      />

      {isNew && !showList && (
        <p className="text-ink-muted mt-1.5 text-micro">
          New brand. It will be created when you save.
        </p>
      )}

      {showList && (
        <ul className="bg-surface border-control absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border p-1 shadow-[0_8px_24px_-8px_oklch(0.22_0.012_60_/_18%)]">
          {suggestions.map((b, i) => (
            <li key={b.id}>
              <button
                type="button"
                className={cn(
                  'text-dense w-full rounded-sm px-2 py-1.5 text-left',
                  i === highlight ? 'bg-wash' : 'hover:bg-wash',
                )}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => commit(b.name)}
              >
                {b.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
