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

- Money lives in exactly one table: `agency_service_rates`, keyed by **agency, service and complexity tier** — because the same service is worth different amounts at Low and at High, and to different partners. An admin fills it in by hand while adding the agency.
- Per-agency rates were themselves out of scope until **2026-08-27**, when the owner reversed that too. A house card (`service_rates`) briefly sat behind them as a fallback and was **removed the same day**: with every agency priced at creation, a rate belonging to nobody in particular had nothing left to do. A service and tier an agency has not priced is **named as unpriced, never zeroed**.
- `service_rates` and its `/admin/service-rates` routes remain in the codebase, holding no rows and read by nothing. They should be dropped once the decision has held for a while.
- The boundary that survives all of this is the one below.
- **No task, agency, brand, ASIN or revision round carries an amount.** Nothing in the ledger changed. `agencies` holds no price column — an agency's rates are rows in their own table, which is why deleting an agency takes its rates and leaves the ledger untouched.
- Because of that, a rate typed today re-prices last month rather than rewriting it. The ledger says what shipped; the calculator says what that was worth, and the two are never entangled.
- The calculator is behind `requireAdmin`, like the rest of the admin router.
- **Currency is USD**, single and implicit. A second currency would be a column on the rate, not a formatting change, and that is a product decision.
- Amounts are stored as integers in cents. Money in floating point drifts across hundreds of rows.

Anything beyond that — invoices, tax, payment status, a second currency — is still out of scope. If a feature request would put an amount on a delivery record, stop and raise it before building.

### Primary users
Two roles since 2026-08-28 (§5.10). OWNER and VIEWER were removed — the owner is an admin, and a read-only role nobody had asked for was one more gate to keep in step.

| Role | What they do | What they see |
|---|---|---|
| **Admin / Ops / Owner** | Maintain agencies and the service catalogue. Close and export periods. Read the whole ledger, the dashboard, pricing and each person's record. | Everything |
| **PM** | Log deliveries. Log revision rounds. | **Only the deliveries they logged** (§5.10) |

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

- Dedupe on `normalize(name) + agency_id` where `normalize` = strip Latin accents, lowercase, then turn every run of non-letter/non-digit into **one space**, then collapse and trim. Punctuation becomes a separator rather than being deleted — deliberately, because it keeps "Acme-Foods" and "Acme Foods" together, which is the common case. The cost is that "H&M" and "HM" are two brands, and since the Brands tab went (§5.5) nothing can merge them.
- Admin must be able to merge two brand records later. Design the schema so merging is possible — brand references live in one foreign-key column, never as a denormalized string on the task row.

### 2.2b Parent and child products
A delivery is logged against the **parent** listing — the ASIN on the card. Each **variation** is one **child product** under it: "KP Duty 30ml" beneath a parent of "KP Duty" (owner, 2026-08-27). That is Amazon's own parent/child structure, and it is what makes "which SKU did this go on" answerable.

- The child is identified by **name** — `task_variations.product_name`, free text and optional — and **since 2026-08-31 by its own ASIN as well**. The name came first and still leads: it is what a person recognises, and a code not to hand must never block recording that the work went out. The code is an addition, not a replacement, and it makes "which ASIN did this go on" answerable at the child level rather than only the parent's. It resolves to a listing under the parent, which revives `task_variations.asin_id` and `asins.parent_asin_id` — built for exactly this in the first place, then left unused when children became name-only. Both are null on everything logged before that date.
- Each variation carries its **own ClickUp task** (`task_variations.clickup_task_id`). It used to be one id per delivered service, which pointed every child's row at whichever task was typed first; each SKU is tracked separately over there. The task-level id remains as the fallback for deliveries logged before this.
- The **first row of a service is the parent**, so it has no child name and no child code of its own — it shows the listing's and saves neither (§2.4). Anywhere a line is listed by name, an empty one falls back to the parent's rather than reading *unnamed*: it has a name, one level up.

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
Every variation is tagged **LOW / MEDIUM / HIGH**, or left untagged. This mirrors the tiers already used elsewhere at WorkinX. The tag is purely descriptive for reporting and workload analysis — it carries no rate.

**STANDALONE is not a fourth tier.** It is the absence of one, stored as a value so the rate card has a key to hang a price on (owner, 2026-08-27). A PM who names no tier is saying *this is the plain version of the service*.

It **prices exactly like a tier**, and has no branch of its own in the code: a per-variation amount, plus a charge for each round past the allowance. Two other readings were tried the same day and both were replaced — one where a variation stopped being standalone once it had siblings or rounds and went unpriced, one where its price was flat and its rounds free. What survives is the simplest thing: a tier key like any other whose name happens to mean "none".

The tier belongs to the **child product**, and the service's own row is not one. So on the logging form the first row of a service — the service delivered plain — never offers a tier and always ships standalone; the picker appears only on the variations added beneath it, and only once each names the product it shipped for. **That row has no product-name field either** (owner, 2026-08-29): it *is* the parent, so it shows the listing's own name as text and saves nothing of its own — the name already lives on the listing. A box there asked for something typed two fields above, and every answer was blank or a copy. Clearing a variation's product name clears its tier, and removing a row clears the tier **and the name** of whatever ends up first, so what a row shows and what it saves can never disagree.

> Consequence, accepted by the owner on 2026-08-27: a tiered deliverable is the service row **plus** a variation, so it charges the flat standalone price alongside the tier. One Low Basic A+ for an agency paying $500/$200 comes to $700, not $200. If that inflates totals in practice, making the service row a header with no charge is a small change, not a rebuild.

The tier pickers offer three buttons and clear back to none. Everywhere it is *shown* — rate card, logging form, ledger, task detail, priced table — it is called **standalone**, in a filled sage capsule that sits off the Low/Medium/High colour ramp because it is a different kind of thing rather than a fourth degree. It briefly read *no tier* on work records, on the reasoning that a rate card names a price while a delivery describes an absence; that was one name too many and the owner said so the same day.

> Two superseded attempts, both from 2026-08-27, kept as a warning against putting a special case back: (1) a variation stopped being standalone once its delivery gained a sibling or a round, and went unpriced — replaced because it withheld a rate the owner had deliberately set; (2) its price was flat and its rounds free — replaced because a plain deliverable still costs something to revise.

### 2.5 Variation count
How many **child products** the deliverable was produced for. This is a **quantity**, distinct from the complexity tier — the brief explicitly separates "number of variations" from "type of variation".

**A delivery is a variation row, not a ledger row** (owner, 2026-08-31). Every variation that shipped is a delivered thing — the parent's own row included — so an agency with two ledger rows each carrying a parent and one child reports **4 deliveries**, not 2. Derived rather than queried: children plus one parent row per ledger row is exactly the number of variation rows.

The ledger TABLE still lists one row per service per ASIN, because that is the unit a delivery is logged and priced as. The count above it says how many things those rows delivered.

**Each variation carries its own code** (owner, 2026-08-31), so a delivered thing can be quoted: `WX-2026-0043` is the service against the parent listing, `WX-2026-0043-1` is its first child, `-2` the second. **Derived, never stored** — the delivery's own immutable code plus the child's number — so it cannot drift from the row it names, needs no column, no sequence and no migration, and the numbering matches the *Variation 1, 2…* labels beside it. It appears on the task record, on every priced line and on the statement.

**Variations exclude the service's own parent row.** The first row of a service is the service delivered plain against the parent listing (§2.4), so a delivery of just the parent reports **0 variations** and parent-plus-one-child reports 1. It is a count, not a change to what shipped: every row is still delivered, still carries its own rounds, and is still priced.

That last point is why the **Billing screen keeps counting priced lines**, parent included. Its figures exist to explain the money, and the parent row is charged at the standalone rate — a column reading 0 next to an amount would be unreadable. So "variations" means children on the ledger, the dashboard, a person's record and the statement's stats, and means priced lines on Billing. Labels follow the same rule: the first child is *Variation 1*, and the parent's own row names itself.

Existing deliveries were recomputed to this definition on 2026-08-31 rather than left mixed — the counter is a denormalized convenience (§3), so rewriting it changes no delivery, variation, round or audit record.

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
users              id, name, email, role[ADMIN|PM], active,
                   deliverer_id? → deliverers   (the Team entry a PM delivers as)
                   failed_login_count, locked_until?, last_failed_login_at?

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

**Not shown anywhere** since 2026-09-01 (owner). The server sets it from the round count, so on a ledger where most jobs get revised it read *In revision* on nearly every record — carrying no decision, and being read as a judgement it was not making. What it stood in for is on the record already, in numbers: the rounds, and how many went beyond the allowance. The column, the API field and the CSV are untouched, so it can come back without a migration; the edit form no longer offers it, which means nothing in the app can set `CLOSED` any more.

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
8. **Delivered by** — user select, defaults to the logged-in user. **Hidden for a PM**, who delivers as themselves; the server stamps it from the session either way (§5.10).
9. **ClickUp task ID/URL** — optional
10. **Notes** — optional

**A delivery is for the parent product or for its variations, never both** (owner, 2026-09-01). Clients commonly take the hero listing now and the child SKUs a month later, and the form used to force a parent line onto every delivery — charging its standalone rate for work that never touched it. A segmented control decides which, and it reshapes the rows beneath: **Parent product** is one line per service and nothing else — no columns and no capsule, since its product and its listing code are the card's and its tier is always standalone, so the table headings would have described one fixed value repeated once per service. Each service band IS the delivered line. **Variations** is the SKUs you list.

**On the variation side, the card IS the variation** (owner, 2026-09-01). Its header asks for the **Variation ASIN**, the **Variation name** and the **Complexity** — one SKU, described once — and *Add another product* becomes *Add another variation*. There is no list of SKUs beneath it and no rows under a service band: everything about the thing delivered is in the header, and each service picked is one delivered line for it.

It reached that shape in three steps on one day, and the two it passed through are worth naming because each was a smaller version of the same fault. First the name, ASIN and tier sat on every variation row under every service band — the same SKU described once per service. Then they moved to a list on the card, with only the tier left per service — still asking one question per service about a SKU that has one answer. The card itself was the last duplicate: a header naming a parent, and a list beneath naming children, when a delivery is for one or the other.

The ledger is unchanged throughout: it still stores a variation row per service, and the form repeats the card's name and tier onto every line it sends. The child's own ASIN is not sent separately on this side, because the card's code already IS that variation's listing.

**One card is open at a time** (owner, 2026-09-01). Each card is roughly 300px, so five products put 1500px of form between the PM and the Save button — and the four already filled in are not the ones being looked at. A card that is not the open one collapses to the line that summarises it: its ASIN, its product name, the services picked, and which side of the toggle it is on. Clicking the line reopens it and collapses whatever was open. Adding a product opens the new card, and removing the open one falls back to the last, so there is always something to type into.

An open card carries a **Done** button, which closes it without opening another. Until then a card collapsed only when you opened a different one or added a product, so someone filling in their last product had no way to stand back and read the stack before saving. It is deliberately not called *Save*: the delivery is saved once, by **Save task** at the foot of the form, and a card that offered its own Save would promise a ledger row that button does not write.

Blank fields are **named rather than skipped** on that line — *no ASIN*, *unnamed* — because an absence you cannot see before saving is one you find out about afterwards. A card with a validation error is **forced open** whatever else is chosen: a collapsed card cannot show what is wrong with it, and a form that refuses to save without saying where is the worst thing this screen could do.

**The choice lives on the card** (`This card is`), one per product (owner, 2026-09-01). A submission can log the hero product for one listing and a variation for another, which a single delivery-level answer cannot say. A duplicate control beside the agency and brand — first the only one, then briefly a bulk setter for all the cards — was removed the same day: two controls for one decision is the duplication this form has spent the day shedding. A new card starts on the same side as the last one, so adding a second variation does not silently begin as a parent, and the lede and the *Add another…* button read the cards rather than a form-wide flag — naming the mixed case outright when the cards disagree. `hasParentLine` is read per card on the way out, so a mixed submission writes the right flag on each ledger row.

The card's own header follows it too. In a parent delivery those two fields ARE the thing delivered, so they read **Product ASIN** and **Product name**; in a variation delivery they are context — the listing the SKUs hang off — so they read **Parent ASIN** and **Parent product name**, since every row below already has a product name and leaving both called the same thing made one phrase mean two things on one card. The lede above the cards follows as well: it described children under every card, which was simply wrong on a delivery that has none.

It is stored, not inferred. `tasks.hasParentLine` (default true) exists because "line 1 is the parent" is a convention and nothing in the rows themselves distinguishes a parent line from a first child — so the variation **count** and the variation **codes** both read the flag rather than position. A children-only delivery of two SKUs reports 2 variations where the same two rows under a parent report 1, and its lines are `-1` and `-2` rather than the bare code and `-1`. The delivery count adds one parent row per ledger row *that has one*, and the Billing rollup subtracts the same way. Everything logged before this defaults to true and is untouched.

**The form stops at what shipped** (owner, 2026-09-01). Three columns, not five: the child product, its ASIN, its tier. The per-variation **ClickUp id** and **revision count** both left it — a delivery is logged at the moment it ships and neither is known then. Rounds happen afterwards and are added on the delivery's own record one at a time, with their own dates, which is what the revision timeline (§5.3) was always for; the *rounds beyond allowance* warning went with the field, since there is nothing to warn about while a delivery is being logged. The columns and the API are untouched — `revisionCount` simply defaults to 0 — so nothing logged before this changed and either field can come back without a migration.

The first row of each service is labelled **Parent product**, then *Variation 1*, *Variation 2*.

**The date is free to pick, and it is called *Created on*** (owner, 2026-09-23 / 2026-09-28). It was capped at today in three places — the input's `max`, a client check and a server 422 — and removing only the first would have moved the failure to the save. All three are gone for this field; the **period lock is untouched** (§4.5), which is the rule that actually protects a reported figure, so a future date simply lands in a month that is still open.

The cap was also **stale**, which is how it surfaced. `/log` is prerendered, so `todayInIST()` ran at build time and shipped as `max="2026-09-23"` in the HTML; React does not patch an attribute mismatch on hydration, so the form refused every date after the day it was last deployed — including today. **Any date computed at render and written into prerendered markup expires with the build.** If a cap comes back, it has to be applied on the client after mount, not in the markup.

Only the label changed, not the meaning: the column, the API field and the period the row lands in are all still `deliveredOn`. **Revision rounds follow the same rule** (owner, 2026-09-28): `requestedOn` is free to pick too, with the `max`, the client check and the 422 all removed. What stays is the **ordering** rule — a round cannot be completed before it was requested — because that one is about the record making sense rather than about the calendar.

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
Four tabs, all behind `requireAdmin`. **The open tab is in the URL** (`/admin?tab=pricing`), not in React state — it was state, so opening a delivery from Billing and pressing back remounted the screen on Agencies: you left from one tab and arrived at another. Switching tabs **replaces** rather than pushes, because a tab is a view of one screen rather than a place you travelled to; pushing would make back walk through every tab you had glanced at. Agencies is the default and carries no parameter.

The tabs:

> **A deleted delivery is counted nowhere.** Soft deletes hide a row from the ledger but leave it in the table, so every `_count` over tasks has to say `where: { deletedAt: null }` — several did not, and the Agencies tab went on showing four deliveries for an agency whose four had all been removed (owner, 2026-09-07). The same fault was in the Services tab, the ASIN list, the people list, and the guards that refuse to delete an agency or a service "because it has deliveries". Fixed in all of them; if a new count appears, filter it.

- **Agencies** — create, edit the revision allowance, set **what that agency pays** (§5.7), activate/deactivate, delete. Adding one is two steps: the details, then the rates — the second opens by itself, since rates cannot be hung on an agency that does not exist yet, and the person who just typed a partner's name is the one who knows what they pay. Deleting one with deliveries takes them with it, after confirmation; a deleted name re-added is restored rather than duplicated.
- **Services** — the catalogue, and switching a service off.
- **Team** — the people who can be named as having delivered work. Not login accounts; most of this list never signs in, and typing a new name on the logging form adds one too. Since 2026-08-28 a name opens **that person's delivery record** — the admin's counterpart to a PM seeing only their own work (§5.10).
- **Billing** — read-only reporting: the month's total by agency, a statement per agency, and every delivery priced. The rates themselves live on the agency (§5.7). Labelled *Billing* since 2026-08-29 — that is what the tab is for, where *Pricing* described the rate card, which is not here. The key, the API route and the statement's path stay `pricing`: renaming identifiers for a word nobody sees is churn.

**There is no Brands tab.** It listed every brand with its agency and counts, and offered rename and remove; the owner removed it on 2026-08-29. Brands were never master data (§2.2) — a PM types one while logging and it is created on save — so the tab existed only to correct the list afterwards, and a tab nobody opens misleads about where brands come from. The brand **entity is untouched**: deliveries still point at a brand row, the ledger and the statement still name it, the logging form still creates one, and the dedupe in §2.2 still holds.

What went with it is the only way to repair a misspelling already on the ledger. Rename was how one client's history was kept from splitting across two rows, and editing a delivery's brand does not merge the old row away. The `/admin/brands` routes are therefore **kept in the API, called by nothing**, so the tab can come back cheaply — the same treatment `service_rates` is under (§1). Delete them if a year passes and nobody has missed it.

**Adding a Team member can create their login** (owner, 2026-08-29). The Add-person form is **one field — the name** — plus a *Give them a login* checkbox. Ticking it creates a PM account and links it to that Team entry (`users.deliverer_id`), which is what lets the server stamp the deliverer from the session (§5.10). A name already on the list — the usual case, since typing one on the logging form adds it — gets an **Add login** action on its row, because otherwise the order in which a colleague was first mentioned would decide whether they could ever sign in. One Team entry gets at most one account; a second is refused rather than silently created.

**Each row also edits.** Name, mailbox and a password reset, inline under the row rather than in a dialog — correcting a spelling is small and frequent, and a modal would put three clicks around a one-field change. Renaming is the useful part: deliveries point at the deliverer row, so the name changes everywhere at once and no history splits — the capability the Brands tab lost when it went (§5.5), kept here where it is used. Renaming into a name already on the list is refused, because that is a merge and merging two people's deliveries is its own operation. **A rename does not drag the address with it**: the two are separate fields for a reason, and re-deriving an address from a corrected spelling would change how someone signs in without anyone asking. A new password revokes every open session, so resetting a compromised one does not leave the intruder signed in.

**The mailbox and the password are their own fields; the domain is not.** Both are filled in from the name — `Anna Maria` → `anna.maria` / `anna-maria-password-for-testing` — and both can be changed, because a person's name and their address need not match: someone on the Team list as "Sam" is plausibly `samantha@` (owner, 2026-08-29). Each field tracks the name only while it is untouched, so typing a name keeps them in step and correcting one is never undone by the next keystroke.

`@workinxdigital.us` is **rendered beside the mailbox as text, not as part of the value** — nothing to select, edit or paste over. The guard is on the server, which appends its own constant and **drops everything from an `@` on**: posting `pwned@evil.example` creates `pwned@workinxdigital.us`. No request can make an account on a domain the company does not own. A mailbox that normalises to nothing is refused, and a password shorter than 10 characters is refused with the same floor `/auth/change-password` enforces, so an account cannot start with a password its owner would be denied for choosing. Dots in the address and hyphens in the password are separate rules on purpose, so neither drifts to match the other.

The starting password is **derived from the name**: `anna-maria-password-for-testing`, matching the accounts provisioned by hand on 2026-08-28. It is shown once on creation so the admin can pass it on, and never stored in the clear or written to the audit log. **It is weak on purpose and temporary by assumption** — anyone who knows a colleague's first name can guess it, and the per-account lockout (§5.10) makes guessing slow rather than impossible. The arrangement is only defensible because people change theirs on `/account`, so that step is load-bearing, not housekeeping. If this outlives the testing phase, the fix is a first-sign-in password change, not a longer default.

**Removing a Team member removes their login** (owner, 2026-09-01). The two are separate tables on purpose — most of the Team never signs in — but deleting the name and leaving the account behind claimed that address for good: `users.email` is unique, so re-adding the same person was refused with *already has an account* by an account nobody could see or reach. The account is deleted outright where it can be; one that is an actor on audit rows is **deactivated and unlinked** instead, since §4.2 does not let a recorded action lose its author. Either way it can no longer sign in, its sessions end, and it no longer blocks the name. The confirm dialog names the address before the click.

**A removed name is revived, not silently reused.** The unique index is on `nameNormalized` alone, so a soft-deleted person still owns their name and `resolveDeliverer` finds them — and returning that row untouched is what "added, but not in the Team list" was: the API answered 201, the account was linked to it, and the tab, which lists only live rows, showed nothing. An add that reports success has to produce something you can see. Reviving rather than inserting a second row keeps the history whole, since every delivery already pointing at that person still does — the same reasoning that makes a re-added agency a restore rather than a duplicate. The display name takes the spelling just typed; it normalizes to the same thing, so it is a capitalisation fix made by the person looking at the form.

**An orphaned account is reclaimed, not refused.** A PM account with no Team entry cannot log anything — a PM's deliverer is stamped from `users.delivererId` (§5.10) — so it is residue, and adding that person again takes it over: relinked, reactivated, new password, sessions ended. An account that is linked to somebody, or that is an admin, is never reclaimed; taking one over would move a colleague's sign-in or demote an admin without anyone asking, so those are refused with a message that says which case it is.

Login accounts can still be managed outside the app with `npm run set-password`; everyone changes their own password on `/account`.

**Every remove and delete asks in a dialog** (owner, 2026-08-29). One component, `components/confirm-dialog.tsx`, behind all four: a delivery on the ledger, an agency, a service, a Team member. The admin screens used a two-step button — the action turned into *Confirm / Cancel* in place — which is cheap and wrong for this: the second click lands where the first one was, so a double click removes a thing, and a strip of small text buttons is a poor place to say what a deletion takes with it. The dialog names the thing in its title, states what actually happens, and puts the **consequence** in the warning colour where there is one ("Takes 4 deliveries and 1 brand with it", "4 deliveries keep the name"). Escape and a click outside both cancel. Only the ledger's removal carries the optional reason, because that is the one that reaches an audit entry somebody may read later (§4.2).

**The company mark has two artworks**, and they are not interchangeable at the same width. `workinx-logo.png` (720×228) is the master; `workinx-logo-dark.png` (1472×410) is the white-X version for dark backgrounds. Both are transparent PNGs, and both carry the same mark at very nearly the same proportion — but the light one is **padded** (the mark fills 85% of the canvas width, 75% of its height) and the dark one is **bled to the edges** (100% × 99%). Sizing them alike therefore drew the dark mark about 18% larger, which is what "the logo grows in dark mode" was.

So `components/logo.tsx` gives the wrapper the size and the light artwork's aspect ratio, fills it with the light mark, and centres the dark one at **85% of the width** — the measured fraction — landing both marks at the same rendered size in a box that never changes, so nothing in the nav shifts when the theme does. Re-measure if either file is replaced; those numbers describe those two files. The swap is a `dark:` variant rather than JavaScript, because `useTheme` is undefined until the client mounts and a JS swap would flash the wrong mark on every load. **The printed statement always takes the light mark** at its natural size, because that page is warm paper in either theme.

**The sign-in screen has a plain email box.** It briefly offered a dropdown of every account, served by a public `GET /auth/accounts` (owner, 2026-08-27); both were removed the next day when the login was hardened, because that endpoint published the staff email list to anyone who opened the site. See §5.10.

### 5.6 Period Close & Export
Per period: summary of everything delivered, grouped by agency and service. Lock action. CSV export. This is the handoff point where the owners take the numbers into their own commercial tooling.


### 5.7 Pricing calculator (admin only)
Added 2026-08-25, reversing the original no-pricing rule — see §1 for what that does and does not permit.

**Rate card.** One per agency, set on the Agencies tab while the agency is being added. One collapsible block per service, four rows — Low, Medium, High, Standalone — each with two amounts: the price of one variation at that tier, and the price of one revision round past the agency's free allowance on such a variation. All four rows carry both amounts — Standalone included, since a plain deliverable still costs something to revise. A **blank box means not priced**, and `0` means free; the two must never be confused, so the placeholder says *not priced* outright. Both amounts on a tier are set together or left together — a per-variation price with no per-round price beside it would charge for the work and forget the revisions. Saved per service rather than per cell, since deciding what a service is worth means deciding all four tiers in one sitting. Audited like every other admin change. Zero means free; a blank is refused rather than stored as zero, because a rate that silently became 0 would understate every total built on it.

**The maths.** Complexity lives on the variation (§2.4), so a rate prices a variation and a delivery is the sum of its variations:

```
rate = agencyRate(agency, service, tier)     // no fallback; unpriced if absent

for each variation:
  perVariation(rate)
  + max(0, rounds − allowanceSnapshot) × perExtraRevision(rate)
```

No branch for standalone: it is a tier key like any other (§2.4).

Rates are read fresh every time the screen calculates — nothing is copied onto the agency or the delivery — so changing a rate re-prices that agency's history rather than rewriting it. A period lock freezes the *ledger*, not the rate card.

More variations therefore cost more, and a High variation costs more than a Low one. The allowance is the one snapshotted onto the task when it was logged (§2.6), so changing an agency's allowance never re-prices its history.

**The breakdown.** Every priced delivery **opens** — the row carries a chevron that turns, because nothing on the row itself said it opened and the sentence above the table is read long before you get to a row. It shows its arithmetic: one line per variation with the product, the tier, **the rate actually applied**, the rounds taken and how many were paid, and the line total. The rate is shown, not just the result — an amount that cannot be checked against the card is an amount nobody can defend in front of a client. The sums come from the same server pass as the row above them, so the two can never disagree.

The same breakdown sits on **a delivery's own record** (owner, 2026-08-29), because "how did that total come about" is asked while looking at the delivery and answering it meant finding the row again on another screen. It is a **card in a second column beside the record**, sticky, so the total stays put while the variations and the edit history scroll past — as a section underneath it left the right half of the page empty and buried the number under everything else. The page takes the same wider shell as the ledger (§5.11) so both columns fit, and below `xl` the grid collapses and the card falls back underneath. The six-column working does not fit a sidebar, so `PriceBreakdown` has a **stacked** layout for it — identical numbers and wording, one axis turned. It is the same pass narrowed with `taskId`, read fresh from the rate card, so the ledger still stores no amount and a rate typed today re-prices the record rather than rewriting it. **Admin only**: the query does not even run for a PM, so their browser never asks for a price and never collects a 403 on a screen they did nothing wrong on.

**The statement (PDF).** Per agency, from the Pricing screen: a print-designed page in the WorkinX brand — tinted masthead, lime total rule, Bricolage display, mono figures — that the browser saves as a PDF. The masthead was a full-bleed noir band until 2026-08-28; the logo asset carries its own black box, so the mark is its own lockup and the band only put a heavy black strip across a document that is otherwise warm paper. It is now the **sage that fills the standalone capsule** (`#d6e5dd`) — already this product's own off-the-ramp colour, chosen to mean "a different kind of thing", which is what a masthead is on a page of figures. Three earlier attempts, kept as a warning: noir put a heavy black strip across a warm page; sand from the vivid card palette read as a different material laid on the sheet; the app's wash was too close to the sheet to register. **When revision rounds are not charged the statement does not mention them at all** — no paid-round count, no struck-through excluded figure. A bill that explains what it decided not to bill for reads as a discount waiting to be queried. The app's header is hidden on paper — the rule hid `nav`, which is the links only, so the logo, theme toggle, bell and Sign out printed across the top of a client's bill; the bar is a `<header>` containing that `<nav>`. Printed rather than drawn by a PDF library, so it keeps the real type and colour instead of a library's generic defaults; `print-color-adjust: exact` is load-bearing, since browsers strip backgrounds by default and would reduce it to a grey skeleton. It is **not an invoice**: no tax, no payment terms, no invoice number, no due date. Those remain out of scope (§1).

**The spacing is the design.** A bill is read by someone checking figures, and the first version set them at roughly half the leading they needed — rows barely taller than their own text, and a gap between two deliveries no larger than the gap inside one, so four jobs read as one column of rules. Row height is now about double, and the space *between* blocks is about double the space *inside* one, which is what makes them separate. One `--gutter` on `.sheet` sets the inner margin for the masthead, lede, stats, every table and the footer, so the left edge is a single line down the page and there is one number to change rather than four. The revisions column is sized for its worst case — the full `2 × $200.00 = $400.00` — because at its old width that equation ran into the amount beside it. The **task code is a capsule** too: it is the one thing on a block somebody quotes back at you, and as loose grey mono above a bold heading it read as a stray line rather than a label. It is neutral — the tier capsules carry the page's only meaningful colour, and a coloured code would compete with them for a distinction it is not making.

Each delivery block names the service, the brand, the listing and the date — and **nobody**. Who delivered the work is an internal fact; a client statement says what shipped, not which colleague shipped it, so the deliverer filter narrows what the document covers without appearing on it. There is **no per-delivery subtotal** either: it repeated the sum of the two or three lines directly beneath it on a page that already states the grand total at the top.

Whether the statement **charges revision rounds** is decided **per delivery** (owner, 2026-08-29), as a checkbox on each row of the priced table — with an all-or-nothing box in the column header, which is what the single switch used to be. It was one switch for the whole document until then, and that forced the same answer on every line; a month's bill often has one job revised as goodwill among a dozen that are chargeable.

**And per child product** (owner, 2026-09-01). A delivery that shipped for three SKUs can have the rounds on one of them absorbed as goodwill while the other two are charged, which a delivery-level tick cannot say — the same argument that moved the switch off the whole document, one level down. A delivery with more than one line opens to show its variations, each with its own tick; a delivery with one line does not, because that line IS the delivery and its code is the task code (§2.5), so listing it would print the same tick twice.

**Collapsed by default**, and that is not a detail. Listing every variation of every delivery outright turned the panel into twenty near-identical capsules — each child repeats its parent's code in full and only the suffix is new — and a control needed once a month should not cost that much reading every day. The chevron carries the number of children; open, a child shows only what it adds to the code above it (`-1`, `-2`, and an em dash for the parent, which has no suffix), its product name, and its amount right-aligned so the figures being chosen between form a column. The full code is on the row's title and is what travels in the URL. A collapsed row whose children disagree says so in words — *$20.00 in rounds · 1 left off* — beside its half-tick, so opening it is for changing the split rather than for discovering there is one. The delivery's own tick sets all of its lines together and shows the honest third state — half-ticked — when they disagree, so the collapsed row can never misdescribe what is under it.

The key in the URL is the **variation code**, not an id: `noRevisions=WX-2026-0045-1` is legible in a link that gets opened, printed and forwarded, where a cuid is not. Links written before this carry task ids, and a task id in that list still excludes that whole delivery; `revisions=0` still means "none of them" for links older still. Both were checked rather than assumed.

It remains **a PDF option only**. Nothing on the Billing screen changes when a box moves: the screen reports what the month was worth, which does not depend on how one document is going to be written, so every figure there always includes revisions. The choice travels in the statement's URL as `noRevisions=` — the **excluded** ids, so charging is the default and a delivery nobody considered is billed rather than quietly given away — and only that agency's ids travel, since another partner's task ids have no business in a URL that gets opened, printed and forwarded. `revisions=0` is still honoured for any link written before this, where it meant "none of them".

The statement totals from its own rows rather than the server's total, because the answer is now per delivery — so the figure at the top is the sum of the figures below it, which is the only version a client can check. When **nothing** on a statement charges rounds it does not mention them at all: no column, no paid-round count, no struck-through figure. A bill that explains what it decided not to bill for reads as a discount waiting to be queried.

**A statement covers one agency's whole range.** Beside the priced table sits **Statements**: one row per agency with a PDF covering every service it had delivered between the two dates, and beneath it that agency's deliveries, each with a tick deciding whether its revision rounds go on the bill.

It was one PDF per *project* for a few hours on 2026-08-29 and the owner reversed it: a partner is billed for a month of work, not for one job at a time. The per-delivery ticks survived the reversal because "charge the rounds on this job but not that one" is a real thing to want *inside* a single statement. Each agency's PDF carries only its own exclusions — another partner's task ids have no business in a URL that gets opened, printed and forwarded. The panel no longer lines up row-for-row with the table beside it and cannot, being grouped by agency where that is grouped by delivery; that is the right way round, since a panel of documents should match the documents rather than the table it happens to sit next to. The `taskId` filter stays on `/admin/statement`, unused by this screen but still what the breakdown on a delivery's own record is built from (§5.3).

It took three attempts on 2026-08-29 and the owner rejected the first two. Columns pinned to the right of the table made every row carry controls it had nothing to do with; moving them inside each opened row hid them behind a click and buried them in arithmetic. The reason both failed is the same: **a table of money is one thing to read and a set of documents to produce is another**, and the second is not a property of the first's rows. Two panels reading as **one row split in two**: the statements panel is a table with the same `Th`/`Td` as the one beside it and every row on a single line, so the halves share a header height and a row height and stay in step without either knowing about the other.

Keeping them in step is one line of CSS worth naming. A left row is as tall as the tier capsule in it — 22px plus the cell's padding — while a statements row holds only 16px text, so they drifted 6px a row and by the seventh delivery the two halves no longer described the same job. The statements cell carries a `min-h` equal to the capsule's height, which makes both rows compute the same way from the same padding rather than pinning either to a magic pixel. An open breakdown does push its half down and the other half does not follow; that is accepted, because mirroring an empty spacer into the statements panel would be a lie about that row. **The ticks nest, four levels deep** (owner, 2026-09-01): the range, an agency, a delivery, a child product — each the same checkbox, each half-ticked when the things under it disagree, each setting everything beneath it when clicked. All-or-nothing used to be two buttons — *Charge all / None* — in the priced table's header next door, which needed the caption *in PDFs* to explain that nothing in that table moved when they were pressed. In this panel it needs no caption: the panel IS the PDFs. It is shown whenever the range has rows, **not only when some of them have revision money** — it hid itself on a range where nothing was chargeable, which is the same fault the per-delivery ticks had and the owner rejected twice. A control that vanishes when it would do nothing reads as broken, and the question it prompts costs more than the control does.

**Every row gets a tick.** Two earlier versions did not — first disabled where there was nothing to charge, then absent there — on the reasoning that a control for a choice with no effect is worse than none. That reasoning is not wrong and it is not what matters: a column where most rows have no control reads as broken, and the owner asked why twice, which is the answer. The tick is now everywhere and means the same thing everywhere; where there is nothing to charge it governs nothing, and the line beside it says why rather than leaving a missing box to imply it.

Chasing that turned up a copy bug worth recording. The row said **"no paid rounds"** wherever the money was zero, and that was wrong on two deliveries: one had nine rounds past its allowance at a per-round rate of `0`, another had four at a tier with no rate at all. Three different facts — *no paid rounds*, *N paid, free at this rate*, *N paid, not priced* — and an admin wondering why a box is missing deserves the right one. The line now matches the Paid rounds column beside it.

**The disclosure leads the row**, and the Admin screen takes the wider measure (§5.11). Both because of the same fault: the priced table is twelve columns, at 1240px it overflowed, and what fell off the right edge was the Total and the chevron — so the one thing saying a row opens was invisible and everything behind it unreachable. Widening the page makes it fit; putting the chevron first means a narrow screen can never hide it again, and a disclosure reads better at the head of a row anyway.

**Filters.** A date range, agency, **who delivered the work** (the Team list, §5.5), and **paid rounds** — with or without.

Paid rounds are the ones past the allowance (§2.6), the only ones that reach the money, so "which jobs went over" is a question asked of a whole month and scrolling to find them is the wrong way to answer it. Filtered **after pricing**, because whether a round is paid is something the pass works out rather than a database predicate — and the rollup, the gaps and the totals are all built from what survives, so every figure on the screen describes the same set of rows.

The range was an `<input type="month">` until 2026-08-29, when the owner asked for a calendar — which settles the open question below: reporting is over **any range**, not calendar months only. A month picker could not answer "what did we ship between the 12th and the 3rd", which is what any contract not starting on the 1st eventually asks. Two native `type="date"` inputs, because the platform's own picker is keyboard-navigable, localised and accessible for free and a hand-built popover would be hundreds of lines to arrive back here. It briefly carried **this month** / **last month** shortcuts; the owner removed them the same day — the screen already opens on the current month, so the common case cost nothing, and two buttons that only ever set the same two fields were furniture in a row that also holds an agency and a person. Moving one end never lets it cross the other — the far end follows, so the screen can never show a total for a range that runs backwards. The heading and the total's label follow the range too: "this month", "in July 2026", or the two dates, and *Month total* becomes *Range total*, because "month total" over eleven days is simply wrong.

**The month.** Deliveries in a date range, priced and **grouped by agency**, with the counts beside the money so a number can be explained.

It carried a PDF link on every agency row until 2026-08-29, when the owner removed it — the Statements panel had just taken over producing documents, and two places offering a PDF invited the question of how they differed. **What went with it is the monthly statement**: a document covering everything one partner was owed for the range, which is what a partner billed monthly actually receives. The per-project statements do not add up to it. The `/admin/statement` page still accepts an agency and a range with no `taskId`, so that document is one link away from existing again; put agency rows at the head of the Statements panel if it turns out to be wanted.

> A four-way group-by — agency, brand, service, tier — was added and removed on 2026-08-28. At this volume the priced table below answers all four questions with more detail, and three of the four modes silently withdrew the PDF link, since a statement is addressed to an agency and the other cuts have nobody to address. "Which service earned most" is a dashboard question (§5.4), not a billing one. The API still accepts `groupBy`; nothing sends anything but `agency`. Service-and-tier combinations delivered with no rate set are **named, not priced at zero** — a total that looks complete while omitting work is the worst thing this screen could do.
### 5.8 Notification centre
Added 2026-08-28. A bell in the nav opening a panel of everything that has happened, newest first, grouped by day.

**Admin only** (owner, 2026-08-29) — see §5.10 for why a per-actor feed was not worth having.

**It is a window onto `audit_log`, not a second write path.** §4.2 already requires an audit row on every mutation, so nothing can happen in this system without appearing here, and there is no feed to keep in step with the ledger. Each row is one audit entry rendered as a sentence — *"Kavitha logged WX-2026-0022 · Basic A+ for Stomp · 45m ago"* — written server-side, because the JSON shapes it interprets have changed several times as the product has and that is not a concern to leak into a component.

Reading `afterJson` is **defensive everywhere**: old rows predate parent/child products, per-variation ClickUp ids and per-agency rates, and one missing field must never take the whole feed down.

**Unread is one timestamp per person** (`users.notifications_seen_at`), not a read-receipt row per entry — for a team of four that table would be thousands of rows recording nothing but "seen". Null means never opened, so a first visit shows everything as unread. The panel marks seen on **open**, not on close, so the rows keep their marks while you read them even as the badge clears.

The count polls every 30s; the entries are fetched only when the panel opens, so a background tab never pulls forty rows for nobody. Marking seen is deliberately **not** audited — it changes no ledger fact, and writing it would put a new row in the feed being marked as read, which never settles.

**Clear all hides, it does not delete.** §4.2 forbids deleting from `audit_log`, so clearing writes a second per-person timestamp (`users.notifications_cleared_at`) and entries older than it stop appearing in *that person's* panel. Everyone else's feed, the task edit history and every export still see every row — proven by test: one person going from 50 visible to 0 left `audit_log` at 93 rows and another person's feed at 50. The empty state says so outright, because "clear" reads like "delete" and this system never deletes a record of what happened.

Colour means what it means everywhere else: lime for a delivery, the warning red for a revision round, neutral for housekeeping. A row links out only when there is somewhere to go, which is tasks alone.

---

### 5.9 Dark mode
Reachable since 2026-08-28 — the palette had been written and unused, so nothing had ever been checked against it. Light remains the default and the identity; dark is a preference (`next-themes`, `system` by default, toggled in the nav and on the sign-in screen).

Three rules shape it, all in `globals.css`:

- **An elevation ladder, not two greys.** Page → card → band, each a visible step, because depth is most of what makes a dark interface feel considered rather than inverted. `--wash` sits *above* `--surface` here: you cannot recede into a dark ground, so a "recessed" tone comes forward instead.
- **Materials.** A sheen down filled shapes, an inset hairline where light would land, and a recess on inputs — each a few percent of white or black. Anything stronger is gloss.
- **Glassmorphism, at two strengths** (owner, 2026-08-29). It began as glass on floating layers only, with panels excluded because "blur behind an opaque page buys nothing". That reasoning was right and its *premise* is what changed: the page is no longer opaque.

  **The ambient field is the load-bearing part.** `backdrop-filter` blurs what is behind an element, so frosting a card over flat black yields a flat black card. The blur needs something to find.

  The first attempt gave it four saturated colour fields — lime, sky, lavender, sage — one at each corner. The owner called it the same day: that is the house style of every AI product landing page, and it read as decoration borrowed from somewhere else. **Corner blobs in several hues are the tell.** What replaced it is a lit room rather than a colour wheel: **one** warm light source high and left with a long falloff, **one** cool almost chroma-free deepening opposite to give the falloff somewhere to go, and **fine monochrome grain** over both. The grain does the most work — glass over a smooth gradient looks like software, glass over a grain looks like a material. It is inline `feTurbulence`, a few hundred bytes, so it cannot arrive late and pop, and it sits at 3.5%: you should not see it when you look for it, you should notice the page looks flat without it.

  **No lime in the background.** Lime is the identity and earns its meaning on the things you act on; spending it on wallpaper is how a brand colour becomes a background colour.

  Both layers are fixed, and `contain: paint` — **not `strict`**, whose size containment zeroed the intrinsic size and rendered the field short of the viewport's bottom and right edges.

  **`.glass`** (nav, popovers, dropdowns, dialogs, toasts) stays the strong one — 28px over an 88% fill — because it has to defeat content it covers. **`bg-surface`** (every card, band, table) is lighter: 16px over **86%**. A panel is a reading surface, and this is a ledger; 86% lets the field through as a tint and no further.

  Two exclusions, both learned by breaking them. **Controls are not glass**: `bg-surface` is also on every input and combobox trigger, and frosting those blanked the border a form control needs and overwrote the inset recess that says a field is a hole rather than a tile — so the panel rule is scoped to container elements, and anything marked `data-slot="control"` or `data-slot="input"` is opted out **by name**. The tag list alone was not enough: a control BUILT from a div — the email field's mailbox-plus-fixed-domain wrapper — is a div, so it lost its border to the panel rule and sat flat beside the password input it is paired with. Tags cannot express intent; the slot marker can, and it also earns that control the same recess and focus ring every real input gets. **Panels do not nest**: an inner `backdrop-filter` samples its parent's already-blurred output, doubling the tint, halving the contrast and paying for two filter passes on the same pixels.

  All of it — fields included — is disabled under `prefers-reduced-transparency` and where `backdrop-filter` is unsupported, since a translucent panel with no blur is just a hard-to-read panel.

  Two things it took a shipped bug to learn. **Declare `-webkit-backdrop-filter` first and the unprefixed property last** — the other way round the minifier treats the standard declaration as redundant and drops it, and what ships is translucency with no blur: the page legible straight through the panel. And **frost needs both a real blur and a fill near-opaque** (28px at 88%); at 16px and 78% the text underneath was still readable, which is a transparency effect rather than a glass one.

The tier ramp keeps its **hues** in the dark (sand, sky, lavender, sage) rather than collapsing to grey — telling Low from High is the only reason those capsules exist. Each tier carries a text colour as well as a fill: on paper that is ink on a pale wash, and in the dark it is a **deep tinted fill with bright lettering of the same hue**. A mid-lightness fill with white text — the first attempt — is too dark to be a colour and too light to be a ground, and comes out muddy every time. Type sits a step below pure white and opens the gaps beneath it, so hierarchy does the work brightness was doing badly.

---

### 5.10 Who sees what
Added 2026-08-28. Until then every signed-in person saw every delivery. Three PMs work in here and the owner asked for **genuine privacy**, not a "mine by default" filter that a cleared dropdown would undo.

**The rule is one line: a PM sees deliveries where `logged_by` is them.** It works because a PM can only log their own work — the server stamps the deliverer from their account and ignores whatever the form posted (§4.6), so logged-by and delivered-by name the same person on every row a PM creates. `users.deliverer_id` is the link between the two notions of person (§5.5) that makes that possible.

It is enforced in the **query**, not after it: `ownedBy(viewer)` is a `where` fragment in `src/domain/visibility.ts`, spread into every read and write path — list, summary, CSV export, the task itself, the duplicate warning, edits, deletes, revision rounds and the edit history. A route that forgets it does not compile, because every one of those functions now demands a `Viewer`. Reaching another PM's delivery returns **404, not 403**: for them it does not exist.

**Notifications are admin-only** since 2026-08-29. They were open to everyone, scoped by actor so a PM saw only rows they were the actor on — correct, and useless: a list of what you did five seconds ago tells you nothing you did not already know. Watching what the team shipped is an owner's job (§5.4), so the bell moved to the admin surface and the router is behind `requireAdmin`. The per-actor scoping in the service stays, unreachable for a PM now, because the privacy rule it enforces should not rest on one middleware line staying where it is.

**History stays with admins.** The deliveries logged before this existed were entered by an admin and remain visible only to admins. The owner chose that over a backfill, and it is why a PM's ledger can be empty while the Team report shows work in their name — the report counts what they *delivered*, the ledger shows what they *logged*.

**Two roles.** OWNER and VIEWER are gone: the owner is an admin, and a read-only role nobody had asked for was one more gate to keep in step. `owner@` and `viewer@` are **deactivated, not deleted** — they are actors on real audit rows, and §4.2 does not allow those to lose their author.

**The admin's counterpart** is Team → a person's name, which opens their delivery record: totals, revision load, who they work for, what they ship, their recent deliveries and their account beside it (last seen, active, and whether a run of failed sign-ins has them locked out). No money on it — what someone's work was worth is a Pricing question, and Pricing already filters by person.

> **Never `router.use(mw)` on a router mounted at `/api/v1`.** Both routers that gate a role sit at the shared prefix, so a path-less `.use()` runs on every request travelling through them to the routers behind. On the notifications router that locked PMs out of the entire API; on the admin router it was hidden by mount order and only showed as a 403 where a 404 belonged. Both are now `.use('/notifications', …)` and `.use('/admin', …)`. If a third appears, scope it.

**Sign-in is hardened, and the public account list is gone.** Two gates, because they catch different attacks:

- **Per address**, 20 attempts in 10 minutes, in process memory. Honest about being best-effort: the API runs on Vercel, so an attacker hitting cold instances gets more than that. It exists to make the cheap case — one script against many emails, which no per-account counter can see — expensive.
- **Per account**, on the user row and therefore surviving every instance: five consecutive failures lock the account for 1 minute, then 5, 15, and 60, and a success clears the run. Checked **before** the password, so a correct guess made during a lockout still opens nothing. Inactive accounts count too — a retired colleague's address is where a guessing run starts.

**A PM with no Team entry cannot sign in** (owner, 2026-09-01). `users.delivererId` ties a login to the person it delivers as and the server stamps every delivery from it, so a PM without one cannot log anything — it is not a working account, it is what a removed colleague leaves behind. Until this, the Team entry went and the login stayed: active, password unchanged, so somebody taken off the Team could still sign in and read a ledger. `canSignIn` in `src/domain/account-access.ts` is the rule, shared by sign-in **and by session resolution** — enforced in only one of those it is enforced nowhere, since the first would leave open sessions alive and the second would let a sign-in succeed and then fail mysteriously on the next request. Refused with the same message and the same lockout counting as a wrong password, because saying which of the two it was would confirm the address is real. Admins are exempt: an admin account is not a deliverer and never needs to be.

The one thing a lockout leaks is that an account exists, since a 429 arrives for a real email and never for an invented one. That is accepted rather than hidden: the address throttle returns the same status and code either way, so a single 429 proves nothing.

**The password field can be read back** (owner, 2026-09-01): an eye toggle in the field, hidden by default and never remembered, since the next person at this keyboard should not inherit the last one's decision. Typing blind is where sign-in fails for people who have the password and are sure of it — a stray capital, a keyboard layout, a pasted trailing space — and one glance settles it. The toggle is `type="button"`: a bare `<button>` inside a form submits, so a click meant to reveal the password would have posted the form. `components/password-input.tsx` is the component; `/account` still uses plain fields.

The `GET /auth/accounts` dropdown from 2026-08-27 was **removed the next day**. It published the staff email list to anyone who opened the site — half of every credential, handed over before a password was typed. The email field is a plain text box again. Do not put it back.

---

### 5.11 Density
Added 2026-08-29, after the owner asked what fifty deliveries would look like. Checked by injecting volume into the API responses in the browser — a rendering test, nothing written to the database — and the answer at fifty rows was: cluttered, in three specific ways.

**Light mode had no bar colours of its own.** The tier tokens are pale fills — grounds for dark lettering to sit in — and `--tier-N-bar` simply aliased them, on the reasoning that on paper a fill is already vivid against a pale track. That held while the only bar was a wide one inside a card, and broke the moment the ledger drew a 3px strip on a near-white row: sand `#e9e1cd` and sky `#cddff8` at three pixels on warm white are invisible, so the strip read as an empty groove. Light now has its own four values — the same hues held down to roughly L\* 50–63 — the way dark already did.

**Colour was doing wallpaper's job.** The ledger drew a filled capsule per distinct tier, so fifty rows carried ninety of them, and the Variations column grew to 215px — wider than Brand, Agency or Service — to hold them. The noisiest column was also taking the width that made every other column truncate mid-word. It is now a **tier strip**: the count, then a 3px bar split in proportion to the mix (`components/tier-strip.tsx`). Colour still means tier and the exact breakdown is still on the row's tooltip; it just stops being the loudest thing on the page. The full capsules stay where there is room and where the tier is the subject rather than a detail — the task record, the rate card, the statement, and the priced table, which carries exactly one per row because there the tier is what sets the price.

**A chip was repeating a fact about the client on every row.** `direct` sat beside the agency name in the ledger. Whether a client is DIRECT or an AGENCY is a property of the client, not of a delivery — it is set on the Admin tab and it is a filter on this screen. Fifty repetitions of it also ate the width this cell needed to spell out "Mindfull Goods" instead of "Mindfull Goods…".

**A badge was truncating a name.** The deliverer and the `edited N×` chip shared one truncating cell, so a five-letter name came out as "Almas…" on any row that had ever been edited. The name now truncates inside its own span and the badge sits outside it. The chip is the count alone at this size; "edited 3×" fifty times is a sentence where a number would do.

**The ledger gets a wider measure than the rest of the app.** 1240px is a comfortable width to read at and too narrow for eleven columns — capped there the table overflowed by about one column at every screen size, so it carried a horizontal scrollbar on a monitor with 400px going spare either side. `main:has([data-measure='wide'])` widens it to 1560px; the page declares the exception and the layout stays ignorant of routes. At 1400px the table now fits with nothing clipped but genuinely long names, which keep their tooltip.

**A person's record said everything at once.** Team → a name stacked five bordered stat tiles, a bordered account strip, two bordered breakdown tables and a bordered list — four chromes deep before a useful number, and for a colleague with no deliveries yet, a screenful of borders saying "Nothing yet" in three places. It answers three questions now with one piece of furniture each: **who is this** (name, account, whether they can sign in — all in the header, because it is all identity), **how much** (one hairline band of figures, no boxes), and **doing what** (who they work for and what they ship as two lines of text rather than two tables, then the recent list). With no deliveries it is one sentence. Nine bordered blocks became one.

**The logging form's service table put the service in a column.** It was the first column and the widest — wide enough to carry "Generated Images" over its category — and it sat on a row whose other cells were mostly empty, because the first row of a service is the parent (§2.4) and the parent has no product name, no ASIN and no tier of its own. Those three cells rendered as em-dashes, so two services with no variations read as six dashes under three headings, and the table's minimum width overflowed its card.

The service is not a property of those rows; it is what they are a list of. It is now a **band across the table**, tinted and ruled, with its rows beneath it — which costs no column width, groups its rows more plainly than a name in a cell did, and is where the *rounds beyond allowance* warning now sits. The freed column went to a narrow one naming what each row is in the vocabulary used everywhere else: **Parent**, then *Variation 1*, *Variation 2*. The parent's ASIN cell is left **blank rather than echoed** — the same code repeated under every service of the card was noise in a column that has a real job on the rows below — and its tier reads as the sage **standalone** capsule (§2.4) rather than grey text. The whole table now fits without scrolling sideways.

**Then the card grew to fit it.** The band cured the dashes but not the width: `Band` lays out `[9rem_1fr]`, and a grid item's default `min-width: auto` is its content's minimum — so the table stretched its column past its `1fr` share and took the Parent ASIN and Product name fields above it along for the ride. The fields grew every time a variation was added. `min-w-0` on the band's content div is the fix, and it belongs there rather than on the card: the band's div is the grid item, so that is the only place the auto minimum can be overridden. The card now measures the same 664px at that window whether the delivery has no variations or two, and anything too wide scrolls inside its own container, which is what the container was always for.

**A row of controls holds no prose.** The tier picker was replaced by the words *name it to tier it* until a variation named its product — a sentence in a column of controls, which also resized that column the moment a name was typed. The picker is now always drawn and disabled until then, at 45% with the reason in its tooltip: same shape, same width, no reflow, and its outline says what will appear there. With that, the row's columns are sized by their controls rather than by explanations, and the whole table fits the card without scrolling — measured at 630px against 642px of room, with two variations open.

The spinner on `input[type=number]` is switched off globally for the same reason. It reserved about 18px inside every number field for arrows nobody clicks on a form built to be typed; the keyboard still steps the value.

**Codes are capsules, wherever a person would quote one.** A delivery's record carried its task code, its parent ASIN, each variation's code, each child ASIN and each ClickUp id as loose grey mono set among prose — so the identifiers read as stray characters rather than as the things you point at when you ask about a line. `CodePill` (in `components/pill.tsx`) gives them the same capsule the statement's task code already had (§5.7), and for the same reason. It is **neutral**: the tier capsules carry this product's only meaningful colour, and a coloured code would compete with them for a distinction it is not making. Neutral is not the same as faint, though — `bg-wash` alone sits about 5% off the card it lies on, which tints a table row without making a code look like a thing you can point at, so the capsule also carries a hairline and full-strength ink. The hairline is an **inset shadow, not a border** (`.pill-code` in `globals.css`), because a border would add 2px and stand the code capsules out of line with the tier capsules on the same row; both are 20px. It is two classes deep because the sheen rule above it is `.pill:not([class*='border'])`, which a single-class utility loses to.

Where several sit on one line — a variation's own code, the ASIN it shipped for, its ClickUp task — they are the same shape and the same grey, so the capsule takes an optional `label` set inside it (`ASIN GKUVKCV`). Without it the only way to tell three identical capsules apart is to hover each one. It is omitted wherever a `<dt>` or a column heading already says which is which.

> Not yet stressed: the totals card's per-agency list, which grows one row per agency and is fine at the ten agencies that exist. If that list ever runs long, cap it and say how many were not shown — a silently truncated list is worse than a short one.

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
- [x] ~~Can a rate vary per agency?~~ Yes, since 2026-08-27 — rates are per agency, per service, per tier, set when the agency is created. There is no house card behind them (§5.7).
- [ ] Should revision rounds carry structured reason codes, and if so what is the list?
- [x] ~~Should the export be per calendar month only, or any arbitrary date range?~~ Any range, since 2026-08-29 — the Pricing screen takes a from/to calendar with month presets (§5.7).
- [ ] Is a reason note required on every task edit, or optional?
- [x] ~~Can any PM edit any task, or only the person who logged it?~~ Only the person who logged it, since 2026-08-28 — they cannot even see anyone else's. Admins edit anything (§5.10).
- [ ] Should `delivered_on` be editable, given it determines which period a task falls into?
