'use client'

import { Check, ChevronsUpDown } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type ComboboxOption = {
  value: string
  label: string
  /** Rendered under the label — used to show a bundle's contents inline (§5.1). */
  hint?: string
  /** Extra text that should match when searching, without being displayed. */
  keywords?: string
  group?: string
}

/**
 * Searchable select for agency, service, complexity filters and delivered-by.
 *
 * Built from a button plus an absolutely positioned list rather than a popover
 * primitive. Two reasons: the logging form needs precise keyboard behaviour to
 * hit its 30-second target (§5.1), and owning the open state outright keeps
 * that behaviour predictable.
 *
 * Keyboard: Enter or Space or ArrowDown opens, typing filters, ArrowUp/Down
 * moves, Enter commits, Escape closes and returns focus to the trigger.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'Nothing found.',
  disabled,
  id,
  invalid,
  clearable = true,
  triggerRef: externalTriggerRef,
}: {
  options: ComboboxOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  id?: string
  invalid?: boolean
  clearable?: boolean
  /** Lets a form return focus here after saving. */
  triggerRef?: React.RefObject<HTMLButtonElement | null>
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)

  const wrapperRef = useRef<HTMLDivElement>(null)
  const ownTriggerRef = useRef<HTMLButtonElement>(null)
  const triggerRef = externalTriggerRef ?? ownTriggerRef
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.value === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) =>
      `${o.label} ${o.hint ?? ''} ${o.keywords ?? ''}`.toLowerCase().includes(q),
    )
  }, [options, query])

  // Group while preserving the catalogue's own order — sortOrder is set by
  // admins for a reason (§2.3), so alphabetical sorting would fight them.
  const grouped = useMemo(() => {
    const groups: { name: string; items: ComboboxOption[] }[] = []
    for (const option of filtered) {
      const name = option.group ?? ''
      const last = groups.at(-1)
      if (last && last.name === name) last.items.push(option)
      else groups.push({ name, items: [option] })
    }
    return groups
  }, [filtered])

  /** Flat order matching what is rendered, so the highlight index lines up. */
  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped])

  useEffect(() => {
    if (!open) return
    setHighlight(Math.max(0, flat.findIndex((o) => o.value === value)))
    searchRef.current?.focus()
  }, [open])

  useEffect(() => {
    setHighlight(0)
  }, [query])

  useEffect(() => {
    function onClickAway(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) close(false)
    }
    document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [])

  function close(refocus = true) {
    setOpen(false)
    setQuery('')
    if (refocus) triggerRef.current?.focus()
  }

  function commit(option: ComboboxOption) {
    onChange(option.value)
    close()
  }

  function onListKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, flat.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const option = flat[highlight]
      if (option) commit(option)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'Tab') {
      close(false)
    }
  }

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
          'border-control bg-surface text-dense flex h-9 w-full items-center justify-between rounded-md border px-2.5 transition-colors duration-[120ms]',
          'hover:border-ink-muted disabled:cursor-not-allowed disabled:opacity-50',
          !selected && 'text-ink-muted',
          invalid && 'border-danger',
        )}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
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
              onKeyDown={onListKeyDown}
              className="h-8 border-0 bg-transparent shadow-none focus-visible:outline-none"
            />
          </div>

          <ul className="max-h-64 overflow-auto p-1" role="listbox">
            {flat.length === 0 && (
              <li className="text-ink-muted px-2 py-3 text-center text-dense">
                {emptyText}
              </li>
            )}

            {clearable && selected && !query && (
              <li>
                <button
                  type="button"
                  className="text-ink-muted hover:bg-wash w-full rounded-sm px-2 py-1.5 text-left text-dense"
                  onClick={() => {
                    onChange('')
                    close()
                  }}
                >
                  Clear selection
                </button>
              </li>
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
                    return (
                      <li key={option.value}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={option.value === value}
                          onMouseEnter={() => setHighlight(i)}
                          onClick={() => commit(option)}
                          className={cn(
                            'text-dense flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left',
                            i === highlight && 'bg-wash',
                          )}
                        >
                          <Check
                            className={cn(
                              'mt-0.5 size-4 shrink-0',
                              option.value === value ? 'opacity-100' : 'opacity-0',
                            )}
                          />
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
        </div>
      )}
    </div>
  )
}
