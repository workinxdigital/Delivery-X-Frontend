/**
 * Bulk entry for jobs covering many product listings.
 *
 * Two paths, because the data arrives in two shapes:
 *
 *   parseAsinCodes  — a pasted column of codes, when the services still have to
 *                     be chosen in the form.
 *   parseAsinCsv    — a spreadsheet where every ASIN has its own services,
 *                     complexity and revision count.
 *
 * Both are pure functions over strings so they can be tested without a browser,
 * a file or a server, and both report what they could not understand rather than
 * throwing: a PM with one bad row in a hundred should be able to fix that row,
 * not lose the paste.
 */
import type { Complexity } from './api/types'

const COMPLEXITIES: Complexity[] = ['LOW', 'MEDIUM', 'HIGH', 'STANDALONE']

/**
 * Split a pasted blob into codes.
 *
 * Accepts newlines, commas, tabs and spaces as separators, because a paste can
 * come from a spreadsheet column, a comma-separated list, or a chat message.
 * Duplicates collapse — the same listing twice in one job is one listing.
 */
export function parseAsinCodes(input: string): { codes: string[]; duplicates: number } {
  const raw = input
    .split(/[\s,;]+/)
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)

  const seen = new Set<string>()
  const codes: string[] = []
  let duplicates = 0

  for (const code of raw) {
    // Compared on the same basis the server dedupes on, so what the form shows
    // matches what gets stored.
    const key = code.replace(/[^A-Z0-9]+/g, '')
    if (!key) continue
    if (seen.has(key)) {
      duplicates += 1
      continue
    }
    seen.add(key)
    codes.push(code)
  }

  return { codes, duplicates }
}

export type CsvRowDraft = {
  code: string
  serviceId: string
  complexity: Complexity
  revisionCount: number
}

export type CsvParseResult = {
  /** Grouped by ASIN, in first-seen order, ready to become form sections. */
  asins: {
    code: string
    lines: { serviceId: string; variations: { complexity: Complexity; revisionCount: number }[] }[]
  }[]
  rowCount: number
  /** Human-readable, one per unusable row, with the line number. */
  problems: string[]
}

/**
 * Parse a spreadsheet of deliveries.
 *
 * Expected columns, in any order, matched case-insensitively by header name:
 *
 *   asin, service, complexity, revisions
 *
 * One row is one variation. Repeating an asin+service pair adds another
 * variation to it, which is how a listing that got two variations of the same
 * service is expressed without a wider format.
 *
 * Services are matched by name or by code, case-insensitively, against the live
 * catalogue passed in — never against a hardcoded list, since the catalogue is
 * admin-editable data (§4.4).
 */
export function parseAsinCsv(
  text: string,
  services: { id: string; name: string; code: string }[],
): CsvParseResult {
  const problems: string[] = []
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)

  if (lines.length === 0) return { asins: [], rowCount: 0, problems: ['The file is empty.'] }

  const header = splitCsvLine(lines[0]!).map((h) => h.trim().toLowerCase())
  const col = {
    asin: header.findIndex((h) => h === 'asin' || h === 'sku'),
    service: header.findIndex((h) => h === 'service'),
    complexity: header.findIndex((h) => h === 'complexity' || h === 'tier'),
    revisions: header.findIndex((h) => h === 'revisions' || h === 'revision rounds'),
  }

  if (col.asin === -1 || col.service === -1) {
    return {
      asins: [],
      rowCount: 0,
      problems: [
        'The first row must be a header naming at least "asin" and "service". Optional: "complexity", "revisions".',
      ],
    }
  }

  // Matched on both name and code so either column from a listing sheet works.
  const byName = new Map<string, string>()
  for (const s of services) {
    byName.set(s.name.trim().toLowerCase(), s.id)
    byName.set(s.code.trim().toLowerCase(), s.id)
  }

  const grouped = new Map<string, Map<string, { complexity: Complexity; revisionCount: number }[]>>()
  const display = new Map<string, string>()
  let rowCount = 0

  for (const [i, line] of lines.slice(1).entries()) {
    const lineNo = i + 2 // 1-based, and the header took line 1.
    const cells = splitCsvLine(line)

    const code = (cells[col.asin] ?? '').trim().toUpperCase()
    const serviceRaw = (cells[col.service] ?? '').trim()
    if (!code) {
      problems.push(`Line ${lineNo}: no ASIN.`)
      continue
    }
    if (!serviceRaw) {
      problems.push(`Line ${lineNo}: no service.`)
      continue
    }

    const serviceId = byName.get(serviceRaw.toLowerCase())
    if (!serviceId) {
      problems.push(`Line ${lineNo}: "${serviceRaw}" is not a service in the catalogue.`)
      continue
    }

    const complexityRaw = (cells[col.complexity] ?? '').trim().toUpperCase()
    const complexity = COMPLEXITIES.find((c) => c === complexityRaw)
    if (complexityRaw && !complexity) {
      problems.push(
        `Line ${lineNo}: "${complexityRaw}" is not a complexity. Use LOW, MEDIUM, HIGH or STANDALONE.`,
      )
      continue
    }

    const revisionsRaw = (cells[col.revisions] ?? '').trim()
    const revisionCount = revisionsRaw === '' ? 0 : Number(revisionsRaw)
    if (!Number.isInteger(revisionCount) || revisionCount < 0) {
      problems.push(`Line ${lineNo}: revisions must be a whole number, 0 or more.`)
      continue
    }

    const key = code.replace(/[^A-Z0-9]+/g, '')
    if (!display.has(key)) display.set(key, code)
    if (!grouped.has(key)) grouped.set(key, new Map())
    const forAsin = grouped.get(key)!
    if (!forAsin.has(serviceId)) forAsin.set(serviceId, [])
    // A missing complexity is left for the form to fill in, rather than guessed.
    forAsin.get(serviceId)!.push({
      complexity: complexity ?? ('' as Complexity),
      revisionCount,
    })
    rowCount += 1
  }

  const asins = [...grouped.entries()].map(([key, byService]) => ({
    code: display.get(key)!,
    lines: [...byService.entries()].map(([serviceId, variations]) => ({ serviceId, variations })),
  }))

  return { asins, rowCount, problems }
}

/**
 * Split one CSV line, honouring double quotes.
 *
 * Deliberately small rather than a dependency: the files this reads are exported
 * from a spreadsheet with four columns, and the only real complication is a
 * quoted value containing a comma.
 */
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        cur += ch
      }
      continue
    }
    if (ch === '"') quoted = true
    else if (ch === ',') {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}
