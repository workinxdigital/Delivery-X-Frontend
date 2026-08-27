'use client'

import { Check, ChevronsUpDown } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type MultiOption = {
  value: string
  label: string
  /** Rendered under the label — used to show a bundle's contents inline (§5.1). */
  hint?: string
  keywords?: string
  group?: string
}

/**
 * Searchable multi-select checklist.
 *
 * The service field uses this because one job can cover several services: a
 * client ordering Basic A+ and Listing Images picks both, and the form grows a
 * dedicated variations section for each.
 *
 * Selecting does NOT close the list, since the whole point is picking more than
 * one. Escape or clicking away closes it.
 */
export function MultiSelect({
  options,
  values,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'Nothing found.',
  disabled,
  id,
  invalid,
}: {
  options: MultiOption[]
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  id?: string
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)

  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) =>
      `${o.label} ${o.hint ?? ''} ${o.keywords ?? ''}`.toLowerCase().includes(q),
    )
  }, [options, query])

  // Group while preserving the catalogue's own order — sortOrder is set by
  // admins for a reason (§2.3).
  const grouped = useMemo(() => {
    const groups: { name: string; items: MultiOption[] }[] = []
    for (const option of filtered) {
      const name = option.group ?? ''
      const last = groups.at(-1)
      if (last && last.name === name) last.items.push(option)
      else groups.push({ name, items: [option] })
    }
    return groups
  }, [filtered])

  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped])

  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])

  useEffect(() => setHighlight(0), [query])

  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [])

  /** Preserve the order things were picked in: it becomes the section order. */
  function toggle(value: string) {
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value])
  }

  const summary =
    values.length === 0
      ? placeholder
      : /*
         * Name what is selected rather than counting it.
         *
         * "2 services" made you open the control to find out which two, on a
         * field whose whole purpose is to say what shipped. Names fit for the
         * common case; past three the count is genuinely more readable than a
         * run-on list.
         */
        values.length <= 3
        ? values
            .map((v) => options.find((o) => o.value === v)?.label ?? v)
            .join(', ')
        : `${values.length} services`

  let index = -1

  return (
    <div ref={wrapperRef} className="relative">
      <button
        id={id}
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-invalid={invalid}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className={cn(
          'border-control bg-surface text-dense flex h-10 w-full items-center justify-between rounded-lg border px-3 transition-colors duration-[120ms]',
          'hover:border-ink-muted disabled:cursor-not-allowed disabled:opacity-50',
          values.length === 0 && 'text-ink-muted',
          invalid && 'border-danger',
        )}
      >
        <span className="truncate">{summary}</span>
        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="bg-surface border-control absolute z-50 mt-1 w-full overflow-hidden rounded-md border shadow-[0_8px_24px_-8px_oklch(0.22_0.012_60_/_18%)]">
          <div className="border-b p-1">
            <Input
              ref={searchRef}
              value={query}
              placeholder={searchPlaceholder}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setHighlight((h) => Math.min(h + 1, flat.length - 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setHighlight((h) => Math.max(h - 1, 0))
                } else if (e.key === 'Enter') {
                  e.preventDefault()
                  const option = flat[highlight]
                  // Stay open: picking several is the point.
                  if (option) toggle(option.value)
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  setOpen(false)
                  setQuery('')
                  triggerRef.current?.focus()
                }
              }}
              className="h-8 border-0 bg-transparent shadow-none focus-visible:outline-none"
            />
          </div>

          <ul className="max-h-64 overflow-auto p-1" role="listbox" aria-multiselectable>
            {flat.length === 0 && (
              <li className="text-ink-muted px-2 py-3 text-center text-dense">{emptyText}</li>
            )}

            {grouped.map((group) => (
              <li key={group.name || '_'}>
                {group.name && (
                  <div className="text-ink-faint px-2 pt-2 pb-1 text-micro font-medium">
                    {group.name}
                  </div>
                )}
                <ul>
                  {group.items.map((option) => {
                    index += 1
                    const i = index
                    const checked = values.includes(option.value)
                    return (
                      <li key={option.value}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={checked}
                          onMouseEnter={() => setHighlight(i)}
                          onClick={() => toggle(option.value)}
                          className={cn(
                            'text-dense flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left',
                            i === highlight && 'bg-wash',
                          )}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-sm border',
                              checked
                                ? 'border-ink bg-ink text-primary-foreground'
                                : 'border-control',
                            )}
                          >
                            {checked && <Check className="size-3" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate">{option.label}</span>
                            {option.hint && (
                              <span className="text-ink-muted block text-micro">
                                {option.hint}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>

          {values.length > 0 && (
            <div className="border-rule flex items-center justify-between border-t px-2 py-1.5">
              <span className="text-ink-muted text-micro">
                {values.length} selected
              </span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-ink-muted hover:text-ink text-micro underline decoration-dotted"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
