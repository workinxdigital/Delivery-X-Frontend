@AGENTS.md

# CLAUDE.md — DeliverX (Delivery Log)

> Working name: **DeliverX**. Rename freely — it is referenced only in the app title and package name.

This file is the single source of truth for how this project is built. Read it fully before writing any code. If a request in chat conflicts with this file, say so and ask before proceeding.

---

## 1. What this system is

An internal system for **WorkinX Digital** that logs every creative task **at the moment it is delivered to the client**, and reports in real time on what has shipped, for whom, and in what volume.

It is a **delivery ledger**, not a project management tool. ClickUp remains the system of record for *work in progress*. DeliverX is the system of record for *work that is done*.

### Scope boundary — read this twice

DeliverX records **facts about delivered work**: who, what, how many, how complex, how many revision rounds. That is what a delivery means, and it never involves money.

**Pricing exists in exactly one place, and it is not the ledger.** The original rule here was "no pricing anywhere in this system". The owner reversed it on **2026-08-25**, asking for an admin-only pricing calculator so the monthly value of what shipped can be read here instead of rebuilt in a spreadsheet. The boundaries of that reversal are the important part:

- The **only** table holding money is `service_rates` — a rate card an admin fills in by hand, keyed by **service and complexity tier**, because the same service is worth different amounts at Low and at High.
- **No task, agency, brand, ASIN or revision round carries an amount.** Nothing in the ledger changed.
- Because of that, a rate typed today re-prices last month rather than rewriting it. The ledger says what shipped; the calculator says what that was worth, and the two are never entangled.
- The calculator is behind `requireAdmin`, like the rest of the admin router.
- **Currency is USD**, single and implicit. A second currency would be a column on the rate, not a formatting change, and that is a product decision.
- Amounts are stored as integers in cents. Money in floating point drifts across hundreds of rows.

Anything beyond that — invoices, tax, payment status, per-agency rate overrides, a second currency — is still out of scope. If a feature request would put an amount on a delivery record, stop and raise it before building.

### Primary users
| Role | What they do |
|---|---|
| **Owner / C-suite** | Watch the live dashboard. Answer "what has shipped this month and for whom?" |
| **Admin / Ops** | Maintain agencies and the service catalogue. Close and export periods. |
| **PM** | Log deliveries. Log revision rounds. |
| **Viewer** | Read-only dashboard access. |

### The one question the system must answer instantly
> "As of right now, how many tasks have we delivered this month, for which agency and brand, of which service type and complexity, and how many revision rounds went beyond the free allowance?"

---

## 2. Core domain concepts

### 2.1 Agency / Client
The engagement owner. Two kinds, same table:
- `AGENCY` — a white-label partner who brings us work from *their* clients.
- `DIRECT` — a brand that engages us directly.

Agencies are **master data**. They are created and managed in the backend before tasks can be logged against them.

### 2.2 Brand (the end company)
The company the creative work is actually for. A brand belongs to an agency (or to a direct client, where brand and client are effectively the same).

**Brands are NOT pre-seeded master data.** They are entered as free text on the task-logging form, with autocomplete against brands already used for that agency. If the typed name doesn't match, a new brand record is created silently on save.

- Dedupe on `normalize(name) + agency_id` where `normalize` = lowercase, trim, collapse whitespace, strip punctuation.
- Admin must be able to merge two brand records later. Design the schema so merging is possible — brand references live in one foreign-key column, never as a denormalized string on the task row.

### 2.3 Service (what was delivered)
The service catalogue is **fully data-driven and admin-editable**. Do not hardcode services in the codebase. New services (video formats, anything invented next quarter) must be addable from the UI without a deploy.

Seed the catalogue with these:

**Standalone services**
- Basic A+
- Premium A+
- Listing Images
- Storefront
- Brand Story
- Generated Images (AI-generated product/lifestyle imagery)
- Video — *see note below*

**Bundles**
- **Basic Bundle** = Basic A+ + Listing Images + Storefront + Brand Story
- **Premium Bundle** = Premium A+ + Listing Images

> Confirm exact bundle composition with the user before seeding — the brief was ambiguous on whether Generated Images sits inside Basic Bundle.

**Video** is a new service line and will have multiple sub-types (e.g. product demo, lifestyle, UGC-style, shorts, brand film). Model video sub-types as ordinary catalogue rows under a `VIDEO` category rather than as a special case. Ask the user for the initial list of video types before seeding.

Each service row carries: `code`, `name`, `category`, `is_bundle`, `bundle_component_ids[]`, `active`, `sort_order`, `notes`. **No price column.**

### 2.4 Complexity tier
Every logged task is tagged with one of: **LOW / MEDIUM / HIGH / STANDALONE**. This mirrors the tiers already used elsewhere at WorkinX. Here it is purely a descriptive attribute for reporting and workload analysis — it carries no rate.

### 2.5 Variation count
An integer ≥ 1. How many variations of the deliverable were produced (1, 2, 3, …). This is a **quantity**, distinct from the complexity tier. Do not conflate the two — the brief explicitly separates "number of variations" from "type of variation".

### 2.6 Revision rounds
- The **first 3 rounds are within allowance.** This number is configurable per agency (`free_revision_allowance`, default `3`), because a specific agency contract may differ.
- Round 4 onwards is flagged **`beyond_allowance = true`**.
- This flag is a **count, not a charge.** The system reports "this task had 2 rounds beyond allowance." It does not know or care what those rounds are worth. That is what the owners price externally.
- Each round is its own record with its own timestamp — the dashboard needs to show revision load over time, not just a counter.
- The allowance in force is **snapshotted onto the task** at logging time, so changing an agency's allowance later does not retroactively reclassify historical rounds.

### 2.7 Task edits
A delivered task is **not frozen**. Details get corrected and updated after the fact — a variation count was wrong, the service was misclassified, a note needs adding. This is normal and the system must support it without friction.

But an edit must never be invisible. Every task carries a **visible edit count and timestamp**:

> `Edited 3× · last 21 Aug 2026, 4:12 PM by Kavitha`

Rules:
- `edit_count` increments by one per save, not per field changed. Changing four fields in one save is one edit.
- A no-op save (nothing actually changed) does **not** increment the counter. Compare values before writing.
- **Adding a revision round is not an edit.** Revision rounds are a separate, expected lifecycle event with their own timeline. Do not let them touch `edit_count` — conflating the two destroys the meaning of both numbers.
- Every edit writes a full field-level before/after entry to `audit_log`. The counter on the task is a denormalized convenience for list rendering; `audit_log` is the truth.
- The full edit history must be viewable from the task detail screen — who, when, and which fields changed from what to what.
- `task_code` is never editable. Everything else is, subject to the period lock in §4.
- Changing the agency clears and re-prompts for the brand, since brands are scoped to an agency.

The point of the counter is signal, not policing. A task edited seven times is telling you something about how that brief was scoped.

---

## 3. Data model (target shape)

Names are guidance, not gospel; keep the relationships.

```
users              id, name, email, role[OWNER|ADMIN|PM|VIEWER], active

agencies           id, name, type[AGENCY|DIRECT], contact_name, contact_email,
                   free_revision_allowance (default 3), status, notes, created_at

brands             id, agency_id → agencies, name, name_normalized,
                   merged_into_id?, created_at
                   [UNIQUE (agency_id, name_normalized)]

services           id, code, name, category, is_bundle, active, sort_order, notes

service_components service_id → services, component_service_id → services

tasks              id, task_code, agency_id, brand_id, service_id, complexity,
                   variation_count, title, clickup_task_id?, delivered_on,
                   delivered_by → users, logged_by → users, status,
                   free_revision_allowance_snapshot,
                   revision_round_count, rounds_beyond_allowance,
                   edit_count (default 0), last_edited_at?, last_edited_by?,
                   period_id?, notes, created_at, updated_at, deleted_at?

revision_rounds    id, task_id, round_number, requested_on, completed_on?,
                   reason_code, beyond_allowance, notes, logged_by → users

periods            id, period_start, period_end, status[OPEN|LOCKED],
                   locked_at, locked_by

audit_log          id, entity, entity_id, action, actor_id, before_json,
                   after_json, created_at
```

`revision_round_count`, `rounds_beyond_allowance`, and `edit_count` on `tasks` are denormalized counters maintained by the application. They exist so the ledger table and dashboard can be queried without aggregating a join on every read. Keep them consistent — recompute the revision counters from the round records rather than incrementing blindly.

Do **not** create a separate `task_edits` table. `audit_log` already carries `entity`, `entity_id`, `action`, `actor_id`, `before_json`, `after_json`, and `created_at` — the edit history UI is a query against it filtered to `entity = 'task'`. Index `audit_log` on `(entity, entity_id, created_at)`.

### Task code
Human-readable, sequential, immutable: `WX-2026-0001`. Generated server-side. Never reuse.

### Task status
`DELIVERED → REVISION_IN_PROGRESS → CLOSED`. A task in a `LOCKED` period is read-only.

---

## 4. Non-negotiable rules

1. **No money in this system.** (§1) No price, rate, amount, cost, currency, or invoice fields. Anywhere.
2. **The ledger is append-first.** Tasks and revision rounds are never hard-deleted. Use `deleted_at` soft deletes, and write every mutation to `audit_log` with before/after JSON.
2a. **Edits are allowed but never silent.** A delivered task can be edited at any time while its period is open. Every edit increments the visible counter, stamps the time and actor, and writes a full before/after record. There is no path in the codebase that mutates a task without going through this. (§2.7)
3. **Timezone:** store all timestamps in UTC; render everything in `Asia/Kolkata`. `delivered_on` is a **date**, not a timestamp — a task delivered at 11pm IST belongs to that IST day.
4. **The service catalogue is data, not code.** No `switch` statements on service names anywhere.
5. **A locked period is immutable.** Tasks in a locked period cannot be edited and no delivery can be backdated into one. The edit form must be visibly disabled with the reason stated, not silently fail on save. Corrections to a locked task are logged as a new task in the current open period, with a note referencing the original task code.
6. **Server-side validation is authoritative.** Client-side validation is a convenience only.
7. **No secrets in the repo.** All config via environment variables, `.env.example` committed, `.env` gitignored.

---

## 5. Screens

### 5.1 Log a Delivery (the most important screen)
This is used many times a day by PMs. Optimise it ruthlessly for speed — target under 30 seconds per entry, keyboard-navigable, no page reloads.

Fields, in order:
1. **Agency / Client** — searchable select from master data
2. **Brand** — free-text with autocomplete scoped to the selected agency; creates on save if new
3. **Service** — searchable select from the catalogue; bundle rows show their components inline
4. **Complexity** — LOW / MEDIUM / HIGH / STANDALONE
5. **Variation count** — number input, default 1
6. **Task title** — free text
7. **Delivered on** — date, defaults to today
8. **Delivered by** — user select, defaults to the logged-in user
9. **ClickUp task ID/URL** — optional
10. **Notes** — optional

Save → confirmation toast with the generated task code → form resets with **agency and brand retained** (PMs usually log several tasks for the same brand in a row).

Guard against accidental duplicates: if an identical `(agency, brand, service, complexity, delivered_on)` combination was logged in the last few minutes, warn before saving — but allow it, since genuine duplicates happen.

### 5.2 Task Ledger
Filterable, sortable table of everything logged. Filters: date range, agency, brand, service, complexity, delivered-by, status, period, and edited-or-not. Rows with `edit_count > 0` show a small `Edited 2×` badge with the last-edited timestamp on hover. CSV export respects active filters and includes `edit_count` and `last_edited_at` alongside every column the owners would need to apply pricing externally.

### 5.3 Task Detail
Full record plus two distinct timelines, visually separated so they are never confused:

**Revision round timeline.** "Add revision round" writes the next round number and flags it against the snapshotted allowance. The UI must clearly show which rounds were within allowance and which went beyond.

**Edit history.** An `Edit task` action opens the same field layout as the logging form, pre-filled. On save, the counter increments and a new entry appears in the history. The header shows the summary line — `Edited 3× · last 21 Aug 2026, 4:12 PM by Kavitha` — and expanding it lists each edit with its timestamp, actor, optional reason, and the specific fields that changed with before and after values. An unedited task shows nothing here; the badge only appears once there is something to report.

If the task's period is locked, both actions are disabled with the reason shown inline.

### 5.4 Owner Dashboard (real-time)
Default view: current month, all agencies.
- **Headline tiles:** tasks delivered (today / WTD / MTD), total variations delivered MTD, revision rounds logged MTD, rounds beyond allowance MTD
- **By agency:** table of tasks delivered, variations, revision rounds, rounds beyond allowance — sorted by task count descending
- **Service mix:** breakdown by service and by complexity
- **Delivery trend:** daily deliveries over the selected range
- **Live feed:** most recent 20 deliveries with agency, brand, service, complexity, variations
- **Revision pressure:** agencies and brands most often exceeding the allowance — the single most useful signal on this screen, since it is where scope leaks

"Real-time" here means **polling on a 30-second interval** plus refetch on window focus. Do not build websockets or SSE. It is not warranted at this data volume.

### 5.5 Admin / Backend
Five tabs, all behind `requireAdmin`:

- **Agencies** — create, edit the revision allowance, activate/deactivate, delete. Deleting one with deliveries takes them with it, after confirmation; a deleted name re-added is restored rather than duplicated.
- **Brands** — list, rename, remove. Deliberately no "add": brands appear when a PM types one while logging, and a DIRECT client's brand is the agency itself.
- **Services** — the catalogue, and switching a service off.
- **Team** — the people who can be named as having delivered work. Not login accounts; nobody here needs an email or a password. Typing a new name on the logging form adds one too.
- **Pricing** — the rate card and the month's total by service (§5.7).

Login accounts are managed outside the app with `npm run set-password`; everyone changes their own password on `/account`.

### 5.6 Period Close & Export
Per period: summary of everything delivered, grouped by agency and service. Lock action. CSV export. This is the handoff point where the owners take the numbers into their own commercial tooling.


### 5.7 Pricing calculator (admin only)
Added 2026-08-25, reversing the original no-pricing rule — see §1 for what that does and does not permit.

**Rate card.** One block per service, four rows — Low, Medium, High, Standalone — each with two amounts: the price of one variation at that tier, and the price of one revision round past the agency's free allowance on such a variation. Saved per service rather than per cell, since deciding what a service is worth means deciding all four tiers in one sitting. Audited like every other admin change. Zero means free; a blank is refused rather than stored as zero, because a rate that silently became 0 would understate every total built on it.

**The maths.** Complexity lives on the variation (§2.4), so a rate prices a variation and a delivery is the sum of its variations:

```
for each variation:
  perVariation(service, tier)
  + max(0, rounds − allowanceSnapshot) × perExtraRevision(service, tier)
```

More variations therefore cost more, and a High variation costs more than a Low one. The allowance is the one snapshotted onto the task when it was logged (§2.6), so changing an agency's allowance never re-prices its history.

**The month.** Deliveries in a date range, priced and grouped by service, with the counts beside the money so a number can be explained. Service-and-tier combinations delivered with no rate set are **named, not priced at zero** — a total that looks complete while omitting work is the worst thing this screen could do.
---

## 6. Tech stack

Default unless the user says otherwise. **Confirm before scaffolding.**

- **Next.js (App Router) + TypeScript**
- **PostgreSQL + Prisma**
- **Tailwind CSS + shadcn/ui**
- **TanStack Query** for data fetching, polling, cache invalidation
- **Zod** for schemas, shared between client and server validation
- **Auth:** email + password with sessions, role-based access. Keep the auth layer thin and swappable.
- **Deployment:** Railway (existing WorkinX infrastructure)
- **Testing:** Vitest. Cover the revision-allowance logic, brand dedupe/normalization, and the aggregation queries behind the dashboard.

### Project structure
```
/app                 routes (App Router)
/components          UI components
/lib
  /domain            revision allowance logic, brand normalization — pure functions
  /db                prisma client, queries
  /validation        zod schemas
/prisma              schema.prisma, migrations, seed.ts
/tests
```

Keep domain logic pure: functions take plain objects and return plain objects, no database calls inside them.

---

## 7. Build phases

Ship each phase working end-to-end before starting the next. Do not scaffold everything up front.

| Phase | Scope | Exit criteria |
|---|---|---|
| **0** | Repo, stack, Prisma schema, migrations, seed data, auth shell | `npm run dev` boots; seeded agencies and services visible in DB; login works |
| **1** | Admin CRUD: agencies, services + bundles, users | An admin can set up a full agency and service catalogue via the UI only |
| **2** | Log a Delivery + Task Ledger + brand-on-the-fly creation | A PM can log 10 deliveries in under 5 minutes; brand dedupe holds |
| **2.5** | Edit a task + edit counter + edit history view + audit log wiring | A task edited three times shows `Edited 3×` with correct timestamps and field-level history; a no-op save does not increment |
| **3** | Revision rounds + allowance logic + tests | Within/beyond allowance split is provably correct; tests cover the 3→4 boundary; adding a round leaves `edit_count` untouched |
| **4** | Owner dashboard with polling | Owner can answer the §1 question in one glance |
| **5** | Period close, exports, audit log UI, brand merge | A month can be closed and exported per agency |

**Future (not v1):** ClickUp webhook auto-population of the delivery form, Slack digest of daily deliveries, client-facing portal.

---

## 8. Working agreements for Claude Code

- **Ask before assuming** on domain questions: bundle composition, video sub-types, whether the revision allowance ever varies by service rather than by agency.
- Propose the Prisma schema and wait for approval before running the first migration.
- One phase per working session. End each phase with a short summary of what was built, what was assumed, and what needs a decision.
- Write migrations, never edit the database by hand.
- Commit at meaningful checkpoints with clear messages.
- Prefer boring, readable code. This will be maintained by a small team.
- If you find yourself adding a numeric field that represents value rather than count, stop — see §1.

## 9. Open decisions

Track these here and update as they are resolved.

- [ ] Does Basic Bundle include Generated Images?
- [ ] Initial list of video sub-types
- [ ] Does a bundle log as one task, or as one task per component service?
- [ ] Is the revision allowance always per agency, or can it vary per service?
- [ ] Should revision rounds carry structured reason codes, and if so what is the list?
- [ ] Should the export be per calendar month only, or any arbitrary date range?
- [ ] Is a reason note required on every task edit, or optional?
- [ ] Can any PM edit any task, or only the person who logged it (with admins able to edit anything)?
- [ ] Should `delivered_on` be editable, given it determines which period a task falls into?
