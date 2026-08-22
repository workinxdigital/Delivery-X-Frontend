# PRODUCT.md — DeliverX

> Derived from `CLAUDE.md`, the project's authoritative spec. Correct anything
> that reads wrong; this file drives design decisions.

## Register

**product** — design serves the task. Authenticated internal tool.

## Product purpose

A delivery ledger for WorkinX Digital. Every creative task is logged at the
moment it ships to the client. It answers one question instantly:

> As of right now, how many tasks have we delivered this month, for which agency
> and brand, of which service and complexity, and how many revision rounds went
> beyond the free allowance?

ClickUp owns work in progress. DeliverX owns work that is done.

## Users

| Who | Context | What they need |
|---|---|---|
| **PM** | Logging the eighth delivery of the afternoon, between Slack messages, ClickUp open on a second monitor | Speed. Under 30 seconds per entry, keyboard throughout, no page reloads |
| **Owner / C-suite** | Glancing at a dashboard mid-meeting | One screen that answers the question above |
| **Admin / Ops** | Monthly close | Trust the numbers, export them cleanly |
| **Viewer** | Read-only | Not to be confused about what a number means |

The PM is the primary user by volume. Everything on the logging screen is
subordinate to their speed.

## Physical scene (theme decision)

A project manager at a desk in Coimbatore, bright overhead office light plus
daylight from a window, mid-afternoon, switching between this tab, Slack, and
ClickUp on a second monitor.

**Therefore: light theme.** A dark UI would fight both the ambient light and the
light-mode tools it sits beside all day. Dark mode exists as a preference, not
as the identity.

## Tone

Plain, precise, unhurried. It is a book of record, not a productivity app
cheering you on. No exclamation marks, no "Great job!", no empty encouragement.
Numbers are stated, not celebrated.

## Strategic principles

1. **Colour means something or it is absent.** The interface is ink on paper.
   The one chromatic signal is reserved for revision rounds beyond allowance,
   because that is where scope leaks and it is the most useful signal in the
   system. If colour appears, it is information.
2. **This is a ledger.** Ruled rows, tabular figures, monospaced identifiers.
   The visual language is a register of entries, not a feed of cards.
3. **The logging form is a speed instrument.** It should fit on one screen
   without scrolling, group into a natural reading order, and never make a PM
   hunt for the save button.
4. **No money, anywhere.** No price, rate, amount, currency, or invoice field in
   any screen. Deliberate product decision, not a phase-one gap.
5. **A count is not a charge.** "2 rounds beyond allowance" is a fact. The
   system never implies what it is worth.

## Anti-references

- **Not a SaaS dashboard.** No dark navy sidebar, no blue primary button, no
  gradient stat tiles, no hero metric.
- **Not a project management tool.** No kanban, no assignee avatars, no
  progress rings. ClickUp already exists.
- **Not an invoicing app.** Despite the folder name, there is no money here.
- **Not decorated.** No card grids, no glass, no illustration. A PM logging
  their eighth delivery does not want personality; they want the field to be
  where they expect it.
