# DeliverX Web

Frontend for **DeliverX**, the internal delivery log for WorkinX Digital.

Talks to [Delivery-x-backend](https://github.com/workinxdigital/Delivery-x-backend) over
HTTP. This app has no database connection and no `DATABASE_URL` — all data
access goes through the API.

> **There is no pricing anywhere in this system.** No rates, amounts, currency,
> or invoices in any screen. See `CLAUDE.md` §1.

## Screens (per `CLAUDE.md` §5)

| Screen | Purpose |
|---|---|
| Log a Delivery | The one used many times a day. Target: under 30 seconds per entry. |
| Task Ledger | Filterable table of everything logged, with CSV export. |
| Task Detail | Revision timeline and edit history, kept visually separate. |
| Owner Dashboard | What shipped this month, for whom, and where revisions are leaking. |
| Admin | Agencies, service catalogue, users, brand merge. |
| Period Close | Month summary, lock, export. |

## Getting started

The API needs to be running first (see the `Delivery-x-backend` repo).

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000

## Notes

- Server-side validation in the API is authoritative. Validation here is a
  convenience for the user, never a guarantee (`CLAUDE.md` §4.6).
- All timestamps are stored UTC by the API and rendered in `Asia/Kolkata`.
- `AGENTS.md` is generated and maintained by `next dev` — leave it alone.

## Build status

Phase 0 — foundations.

- [x] **0.1** App boots; reaches the API cross-origin; status page confirms wiring
- [ ] **0.4** Login screen
- [ ] **Phase 1** Admin CRUD screens

See `CLAUDE.md` §7 for the full phase plan.
