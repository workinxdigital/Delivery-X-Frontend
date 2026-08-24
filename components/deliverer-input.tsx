'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { getDeliverers } from '@/lib/api/client'
import { cn } from '@/lib/utils'

/**
 * Who delivered the work.
 *
 * A list of the team that also takes a name it has never seen — the same
 * treatment brands and ASINs get. It used to be a select over login accounts,
 * which meant the dropdown offered "Admin", "Owner" and "Project Manager": the
 * four accounts that can sign in, not the people who actually deliver.
 *
 * Typing a new colleague adds them on save, so nobody needs an account, an
 * email address or an admin screen to appear on a delivery record.
 */
export function DelivererInput({
  value,
  onChange,
  id,
  invalid,
}: {
  value: string
  onChange: (value: string) => void
  id?: string
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const { data: people = [] } = useQuery({
    queryKey: ['deliverers'],
    queryFn: getDeliverers,
    staleTime: 60_000,
  })

  const typed = value.trim().toLowerCase()
  const suggestions = people
    .filter((p) => p.name.toLowerCase() !== typed)
    .filter((p) => (typed ? p.name.toLowerCase().includes(typed) : true))
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

  const isNew = typed.length > 0 && !people.some((p) => p.name.toLowerCase() === typed)

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        id={id}
        value={value}
        aria-invalid={invalid}
        autoComplete="off"
        placeholder="Pick or type a name"
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
          New name. They will be added to the team when you save.
        </p>
      )}

      {showList && (
        <ul className="bg-surface border-control absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border p-1 shadow-[0_8px_24px_-8px_oklch(0.22_0.012_60_/_18%)]">
          {suggestions.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                className={cn(
                  'flex w-full items-baseline justify-between gap-3 rounded-sm px-2 py-1.5 text-left text-dense',
                  i === highlight ? 'bg-wash' : 'hover:bg-wash',
                )}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => commit(p.name)}
              >
                <span>{p.name}</span>
                {p.taskCount > 0 && (
                  <span className="text-ink-faint text-micro">{p.taskCount} delivered</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
