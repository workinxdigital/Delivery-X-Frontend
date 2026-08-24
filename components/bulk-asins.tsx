'use client'

import { useRef, useState } from 'react'
import { buildCsvTemplate, parseAsinCodes, parseAsinCsv } from '@/lib/bulk-asins'
import type { Complexity, Service } from '@/lib/api/types'
import { cn } from '@/lib/utils'

export type BulkAsin = {
  code: string
  lines: { serviceId: string; variations: { complexity: Complexity; revisionCount: number }[] }[]
}

/**
 * Bulk entry for a job covering many product listings.
 *
 * Filling a hundred sections by hand is not work anyone should do, so there are
 * two ways in, matching the two shapes the data actually arrives in:
 *
 *   Paste codes — a column copied from a listing sheet. Creates the sections;
 *                 services are still chosen in the form, which is right when the
 *                 mix differs per ASIN.
 *   Upload CSV  — a sheet that already knows the services, complexity and
 *                 revision count per ASIN. Fills everything in.
 *
 * Both preview before they touch the form, and the CSV path lists the rows it
 * could not read with their line numbers. One unreadable row in a hundred should
 * cost you that row, not the upload.
 */
export function BulkAsins({
  services,
  onApply,
}: {
  services: Service[]
  /** Replaces the current sections with what was parsed. */
  onApply: (asins: BulkAsin[]) => void
}) {
  const [open, setOpen] = useState<'paste' | 'csv' | null>(null)
  const [pasted, setPasted] = useState('')
  const [problems, setProblems] = useState<string[]>([])
  const [note, setNote] = useState<string | null>(null)
  /** The chosen file's name, kept so it can be shown and cleared. */
  const [fileName, setFileName] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  /**
   * Put the upload back to empty.
   *
   * A rejected file otherwise sits there with its errors and no way to take it
   * back — the only escape being to upload something else, which is not the
   * same thing as changing your mind. Clears the input itself too, so choosing
   * the same file again still fires a change event.
   */
  function clearFile() {
    setFileName(null)
    setProblems([])
    setNote(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const preview = open === 'paste' ? parseAsinCodes(pasted) : null

  function applyPaste() {
    const { codes, duplicates } = parseAsinCodes(pasted)
    if (codes.length === 0) {
      setProblems(['No codes found in that paste.'])
      return
    }
    onApply(codes.map((code) => ({ code, lines: [] })))
    setProblems([])
    setNote(
      `${codes.length} ASIN${codes.length === 1 ? '' : 's'} added` +
        (duplicates > 0 ? `, ${duplicates} duplicate${duplicates === 1 ? '' : 's'} skipped` : '') +
        '. Pick the services for each below.',
    )
    setPasted('')
    setOpen(null)
  }

  async function applyCsv(file: File) {
    const text = await file.text()
    const result = parseAsinCsv(
      text,
      services.map((s) => ({ id: s.id, name: s.name, code: s.code })),
    )
    setProblems(result.problems)

    if (result.asins.length === 0) {
      setNote(null)
      return
    }

    onApply(result.asins)
    const rows = result.asins.reduce((n, a) => n + a.lines.length, 0)
    setNote(
      `${result.asins.length} ASINs and ${rows} service row${rows === 1 ? '' : 's'} loaded from ${file.name}` +
        (result.problems.length > 0
          ? `. ${result.problems.length} row${result.problems.length === 1 ? '' : 's'} skipped — see below.`
          : '. Check the sections below before saving.'),
    )
    setOpen(null)
  }

  return (
    <div className="border-rule bg-wash/40 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-ink-muted text-micro">Many ASINs?</span>
        <Tab active={open === 'paste'} onClick={() => setOpen(open === 'paste' ? null : 'paste')}>
          Paste a list of codes
        </Tab>
        <Tab active={open === 'csv'} onClick={() => setOpen(open === 'csv' ? null : 'csv')}>
          Upload a spreadsheet
        </Tab>
      </div>

      {open === 'paste' && (
        <div className="mt-3">
          <textarea
            autoFocus
            rows={5}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={'B08N5WRWNW\nB07XJ8C8F5\nB0CXYZ1234'}
            className="border-control bg-paper text-dense w-full rounded-md border px-3 py-2 font-mono focus-visible:ring-ink focus-visible:ring-2 focus-visible:outline-none"
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={applyPaste}
              disabled={!preview || preview.codes.length === 0}
              className="bg-ink text-paper text-micro rounded-md px-3 py-1.5 font-medium disabled:bg-wash disabled:text-ink-muted"
            >
              Add {preview?.codes.length ?? 0} ASIN
              {preview?.codes.length === 1 ? '' : 's'}
            </button>
            <span className="text-ink-faint text-micro">
              One per line, or straight from a spreadsheet column. Replaces the sections
              below.
            </span>
          </div>
        </div>
      )}

      {open === 'csv' && (
        <div className="mt-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                setFileName(file.name)
                void applyCsv(file)
              }
            }}
            className="text-dense file:border-control file:bg-paper file:text-ink file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:text-micro"
          />
          {fileName && (
            <button
              type="button"
              onClick={clearFile}
              className="text-ink-muted hover:text-beyond mt-2 block text-micro transition-colors duration-[120ms]"
            >
              Remove {fileName}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              /*
               * Built in the browser from the live catalogue rather than served
               * as a static file, so the service names in it are always the
               * ones this instance will actually accept.
               */
              const blob = new Blob([buildCsvTemplate(services)], {
                type: 'text/csv;charset=utf-8',
              })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = 'deliverx-asin-template.csv'
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="text-ink-muted hover:text-ink mt-2 block text-micro underline decoration-dotted underline-offset-2"
          >
            Download a template with your service names
          </button>

          <p className="text-ink-faint mt-2 text-micro">
            Header row naming <span className="code">asin</span>,{' '}
            <span className="code">service</span>, and optionally{' '}
            <span className="code">complexity</span> and{' '}
            <span className="code">revisions</span>. One row per variation — repeat an ASIN
            and service to add a second variation of it. Services match on name or code.
          </p>
        </div>
      )}

      {note && <p className="text-ink-muted mt-3 text-micro">{note}</p>}

      {problems.length > 0 && (
        <div className="mt-3">
          <p className="text-beyond text-micro font-medium">
            {problems.length} row{problems.length === 1 ? '' : 's'} could not be read:
          </p>
          {/* Capped, because a wrong header column produces one problem per line
              and a wall of identical messages helps nobody. */}
          <ul className="text-ink-muted mt-1 space-y-0.5 text-micro">
            {problems.slice(0, 8).map((p) => (
              <li key={p}>{p}</li>
            ))}
            {problems.length > 8 && <li>…and {problems.length - 8} more.</li>}
          </ul>
        </div>
      )}
    </div>
  )
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-micro rounded-full px-2.5 py-1 transition-colors duration-[120ms]',
        active ? 'bg-ink text-paper' : 'text-ink-muted hover:text-ink hover:bg-wash',
      )}
    >
      {children}
    </button>
  )
}
