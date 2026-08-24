'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { getAsins } from '@/lib/api/client'
import { cn } from '@/lib/utils'

/**
 * The ASIN field.
 *
 * Deliberately the same shape as the brand field: a text box that drops a list
 * of what this brand has had before, where picking is quick and typing a code
 * that has never been seen is equally fine. ASINs are not master data — nobody
 * sets them up in advance, they appear the first time a delivery names one.
 *
 * It replaced a native datalist, which renders differently in every browser,
 * cannot be styled to match the rest of the form, and gives no keyboard
 * highlighting. Same component vocabulary as the brand above it, so the two
 * fields behave identically rather than merely looking similar.
 */
export function AsinInput({
  brandId,
  value,
  onChange,
  id,
  invalid,
}: {
  /** Null while the brand is new or still being typed — then there is nothing to suggest. */
  brandId: string | null
  value: string
  onChange: (value: string) => void
  id?: string
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const { data: known = [] } = useQuery({
    queryKey: ['asins', brandId],
    queryFn: () => getAsins(brandId!),
    enabled: Boolean(brandId),
    staleTime: 30_000,
  })

  // Filtered as you type, and never suggesting what is already in the box.
  const typed = value.trim().toUpperCase()
  const suggestions = known
    .filter((a) => a.code.toUpperCase() !== typed)
    .filter((a) => (typed ? a.code.toUpperCase().includes(typed) : true))
    .slice(0, 8)

  const showList = open && suggestions.length > 0

  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [])

  function commit(code: string) {
    onChange(code)
    setOpen(false)
    setHighlight(-1)
  }

  const isNew = typed.length > 0 && !known.some((a) => a.code.toUpperCase() === typed)

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        id={id}
        value={value}
        aria-invalid={invalid}
        autoComplete="off"
        placeholder={known.length > 0 ? 'Pick or type a code' : 'B0…'}
        // Uppercased on the way in, matching how Amazon prints them and how
        // they are deduped when saved.
        onChange={(e) => {
          onChange(e.target.value.toUpperCase())
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
            commit(suggestions[highlight]!.code)
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        className="code"
      />

      {isNew && known.length > 0 && !showList && (
        <p className="text-ink-muted mt-1.5 text-micro">
          New ASIN for this brand. It will be created when you save.
        </p>
      )}

      {showList && (
        <ul className="bg-surface border-control absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border p-1 shadow-[0_8px_24px_-8px_oklch(0.22_0.012_60_/_18%)]">
          {suggestions.map((a, i) => (
            <li key={a.id}>
              <button
                type="button"
                className={cn(
                  'flex w-full items-baseline justify-between gap-3 rounded-sm px-2 py-1.5 text-left text-dense',
                  i === highlight ? 'bg-wash' : 'hover:bg-wash',
                )}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => commit(a.code)}
              >
                <span className="code">{a.code}</span>
                {/* How much has already gone out for this listing — enough to
                    tell two similar codes apart at a glance. */}
                {a.taskCount > 0 && (
                  <span className="text-ink-faint text-micro">
                    {a.taskCount} delivered
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
