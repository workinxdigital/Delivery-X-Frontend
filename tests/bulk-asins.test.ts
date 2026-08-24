import { describe, expect, it } from 'vitest'
import { parseAsinCodes, parseAsinCsv } from '@/lib/bulk-asins'

const SERVICES = [
  { id: 'svc-basic', name: 'Basic A+', code: 'BASIC_A_PLUS' },
  { id: 'svc-listing', name: 'Listing Images', code: 'LISTING_IMAGES' },
  { id: 'svc-video', name: 'Video — Product Demo', code: 'VIDEO_PRODUCT_DEMO' },
]

describe('parseAsinCodes', () => {
  it('reads a pasted spreadsheet column', () => {
    expect(parseAsinCodes('B08N5WRWNW\nB07XJ8C8F5\nB0CXYZ1234').codes).toEqual([
      'B08N5WRWNW',
      'B07XJ8C8F5',
      'B0CXYZ1234',
    ])
  })

  it('accepts commas, tabs and spaces, since a paste can be any of them', () => {
    expect(parseAsinCodes('B08N5WRWNW, B07XJ8C8F5\tB0CXYZ1234').codes).toHaveLength(3)
  })

  it('uppercases, matching how the codes are stored', () => {
    expect(parseAsinCodes('b08n5wrwnw').codes).toEqual(['B08N5WRWNW'])
  })

  it('collapses duplicates and says how many it dropped', () => {
    const out = parseAsinCodes('B08N5WRWNW\nb08n5wrwnw\nB08-N5W-RWNW\nB07XJ8C8F5')
    expect(out.codes).toEqual(['B08N5WRWNW', 'B07XJ8C8F5'])
    expect(out.duplicates).toBe(2)
  })

  it('ignores blank lines and stray punctuation', () => {
    expect(parseAsinCodes('\n\nB08N5WRWNW\n  \n---\n').codes).toEqual(['B08N5WRWNW'])
  })

  it('returns nothing for an empty paste rather than a phantom code', () => {
    expect(parseAsinCodes('   ').codes).toEqual([])
  })
})

describe('parseAsinCsv', () => {
  it('groups rows by ASIN, and services within them', () => {
    const csv = [
      'asin,service,complexity,revisions',
      'B08N5WRWNW,Basic A+,MEDIUM,2',
      'B08N5WRWNW,Listing Images,LOW,0',
      'B07XJ8C8F5,Video — Product Demo,HIGH,4',
    ].join('\n')

    const out = parseAsinCsv(csv, SERVICES)
    expect(out.problems).toEqual([])
    expect(out.rowCount).toBe(3)
    expect(out.asins).toHaveLength(2)
    expect(out.asins[0]!.code).toBe('B08N5WRWNW')
    expect(out.asins[0]!.lines).toHaveLength(2)
    expect(out.asins[1]!.lines[0]!.variations[0]).toEqual({
      complexity: 'HIGH',
      revisionCount: 4,
    })
  })

  it('treats a repeated asin+service pair as a second variation', () => {
    const csv = [
      'asin,service,complexity,revisions',
      'B08N5WRWNW,Basic A+,LOW,1',
      'B08N5WRWNW,Basic A+,HIGH,3',
    ].join('\n')

    const out = parseAsinCsv(csv, SERVICES)
    expect(out.asins).toHaveLength(1)
    expect(out.asins[0]!.lines).toHaveLength(1)
    expect(out.asins[0]!.lines[0]!.variations).toEqual([
      { complexity: 'LOW', revisionCount: 1 },
      { complexity: 'HIGH', revisionCount: 3 },
    ])
  })

  it('matches a service by its code as well as its name', () => {
    const csv = 'asin,service\nB08N5WRWNW,LISTING_IMAGES'
    expect(parseAsinCsv(csv, SERVICES).asins[0]!.lines[0]!.serviceId).toBe('svc-listing')
  })

  it('accepts columns in any order and any case', () => {
    const csv = 'Revisions,SERVICE,Asin\n2,Basic A+,B08N5WRWNW'
    const out = parseAsinCsv(csv, SERVICES)
    expect(out.problems).toEqual([])
    expect(out.asins[0]!.lines[0]!.variations[0]!.revisionCount).toBe(2)
  })

  it('accepts sku as a header, since listing exports call it that', () => {
    const csv = 'sku,service\nB08N5WRWNW,Basic A+'
    expect(parseAsinCsv(csv, SERVICES).asins).toHaveLength(1)
  })

  it('keeps the good rows and reports the bad ones by line number', () => {
    const csv = [
      'asin,service,complexity,revisions',
      'B08N5WRWNW,Basic A+,MEDIUM,2',
      'B07XJ8C8F5,Nonexistent Service,LOW,0',
      ',Basic A+,LOW,0',
      'B0CXYZ1234,Basic A+,SILLY,0',
      'B0CXYZ1234,Basic A+,LOW,-2',
    ].join('\n')

    const out = parseAsinCsv(csv, SERVICES)
    expect(out.rowCount).toBe(1)
    expect(out.asins).toHaveLength(1)
    expect(out.problems).toHaveLength(4)
    expect(out.problems[0]).toContain('Line 3')
    expect(out.problems[0]).toContain('Nonexistent Service')
    expect(out.problems[1]).toContain('Line 4')
    expect(out.problems[3]).toContain('whole number')
  })

  it('defaults a missing revisions cell to zero rather than rejecting the row', () => {
    const csv = 'asin,service,complexity\nB08N5WRWNW,Basic A+,LOW'
    const out = parseAsinCsv(csv, SERVICES)
    expect(out.problems).toEqual([])
    expect(out.asins[0]!.lines[0]!.variations[0]!.revisionCount).toBe(0)
  })

  it('handles a quoted service name containing a comma', () => {
    const services = [{ id: 'svc-x', name: 'A+, Premium', code: 'X' }]
    const csv = 'asin,service\nB08N5WRWNW,"A+, Premium"'
    expect(parseAsinCsv(csv, services).asins[0]!.lines[0]!.serviceId).toBe('svc-x')
  })

  it('refuses a file with no usable header instead of guessing', () => {
    const out = parseAsinCsv('B08N5WRWNW,Basic A+', SERVICES)
    expect(out.asins).toEqual([])
    expect(out.problems[0]).toContain('header')
  })

  it('says the file is empty rather than returning silence', () => {
    expect(parseAsinCsv('   \n  ', SERVICES).problems[0]).toContain('empty')
  })

  it('scales to a realistic 120-ASIN sheet', () => {
    const rows = ['asin,service,complexity,revisions']
    for (let i = 0; i < 120; i += 1) {
      rows.push(`B${String(i).padStart(9, '0')},Basic A+,MEDIUM,${i % 4}`)
    }
    const out = parseAsinCsv(rows.join('\n'), SERVICES)
    expect(out.problems).toEqual([])
    expect(out.asins).toHaveLength(120)
    expect(out.rowCount).toBe(120)
  })
})
