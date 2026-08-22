# DESIGN.md — DeliverX

## The idea

**A ledger, in ink on paper.** Ruled rows, tabular figures, monospaced
identifiers. The interface is monochrome, and the single chromatic colour is
reserved for one meaning: **a revision round that went beyond allowance.**

Colour is therefore information, never decoration. When a PM sees colour on this
screen, scope has leaked. That is the most useful signal in the system
(`CLAUDE.md` §5.4), so it gets the only voice.

### Reflex check (why it does not look like the obvious answer)

- **First-order reflex** for an internal ops tool: dark navy sidebar, blue
  primary button, grey card grid, gradient stat tiles. Rejected.
- **Second-order reflex** for "internal tool that is not blue SaaS": near-black
  Linear clone with a violet accent, or an editorial-typographic admin. Also
  rejected.
- **What drives this instead** is the domain: the product is literally a
  register of entries. The visual language comes from that, not from the
  category.

## Colour

OKLCH throughout. No `#000`, no `#fff`. Every neutral is tinted warm (hue ~70,
chroma 0.004–0.012) so the surface reads as paper rather than screen grey.

### Light (default)

| Token | Value | Use |
|---|---|---|
| `--paper` | `oklch(0.985 0.004 75)` | page background |
| `--surface` | `oklch(0.998 0.002 75)` | inputs, dropdown panels |
| `--ink` | `oklch(0.22 0.012 60)` | body text, primary fill |
| `--ink-muted` | `oklch(0.52 0.008 70)` | labels, secondary text |
| `--ink-faint` | `oklch(0.68 0.006 70)` | placeholders, disabled |
| `--rule` | `oklch(0.90 0.006 75)` | hairlines, borders |
| `--rule-strong` | `oklch(0.84 0.007 75)` | input borders, table header rule |
| `--wash` | `oklch(0.965 0.005 75)` | row hover, subtle fills |
| `--beyond` | `oklch(0.55 0.155 45)` | **the only accent.** Rounds beyond allowance |
| `--danger` | `oklch(0.52 0.18 25)` | validation errors, destructive |

### Dark (a preference, not the identity)

Same roles, inverted: `--paper oklch(0.19 0.006 70)`, `--ink oklch(0.95 0.004 80)`,
`--beyond oklch(0.72 0.14 50)`. Chroma rises slightly as lightness drops so the
accent stays legible without glowing.

### Rules

- Within allowance is **not** green. It is the normal case and gets no colour.
- Success feedback is ink, not green. The tone is "recorded", not "well done".
- No colour on inactive or hover states beyond a neutral wash.

## Typography

One family. System stack, no webfont: fastest, native on every platform, and the
spec asks for boring.

```css
--font-ui: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
--font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
```

Fixed rem scale, ratio ≈1.2. Dense, because this is a data tool.

| Step | Size | Use |
|---|---|---|
| `micro` | 0.6875rem / 11px | badges, table micro-labels |
| `small` | 0.75rem / 12px | field labels, helper text, filter labels |
| `dense` | 0.8125rem / 13px | table body |
| `body` | 0.875rem / 14px | inputs, buttons, prose |
| `title` | 1.375rem / 22px | page title |

Weights: 400 body, 500 labels and table headers, 600 page titles and numbers.

**Every numeral is tabular** (`font-variant-numeric: tabular-nums`) so counts and
dates align down a column. **Task codes are monospace** with tight tracking:
they are identifiers, and should read as such.

## Layout

- **No cards.** The form and the table sit directly on the paper, separated by
  hairlines. A ledger is ruled, not boxed. Nested panels are banned outright.
- **The logging form groups into three bands**, each with a quiet label, in
  natural reading order: who it is for, what shipped, when and who. A hairline
  between bands. This is what turns ten identical fields into three glanceable
  decisions.
- **The form fits one screen.** Short fields pair into two columns. The action
  bar sticks to the bottom so the save button is never below the fold.
- **Spacing rhythm varies**: 6px label to control, 16px between fields in a
  band, 28px between bands. Uniform spacing everywhere is what made the first
  version read as a government form.
- Radius 6px. A ledger is not pill-shaped.

## Components

Every interactive element ships default, hover, focus, active, disabled, and
where relevant loading and error.

- **Focus is always visible**: 2px ink ring, 2px offset. Never removed.
- **Complexity is a segmented control**, one row of four. It is an ordered
  scale, so it reads left to right; a 2×2 grid destroyed that.
- **Table**: sticky header, hairline row rules, `--wash` on hover, numerics
  right-aligned, no zebra striping.
- **Filters**: one compact toolbar of the three most-used controls, the rest
  behind a disclosure, with active filters shown as removable chips. Eight
  always-visible filter boxes buried the table.
- **Loading** is a skeleton in place, never a centred spinner.
- **Empty states** teach: they say what to do, not "no data".

## Motion

150–200ms, `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quart). Hover colour
120ms. Motion conveys state only: open, close, selected, saved. No page-load
choreography, no bounce, nothing decorative.
