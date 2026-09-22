# MASTER PROMPT — HVAC Company ERP Build

Use this as the top-level brief when handing this project to a dev team or an AI coding agent (Claude Code, etc.). It references the three companion documents — read all four before writing any code.

---

## Companion documents
1. `01-ARCHITECTURE.md` — tech stack, hosting, module boundaries, data model overview.
2. `02-LOGICS.md` — the business rules: job state machine, accounting posting engine, hisaab/expense logic, attendance logic, payroll approval logic, feedback/call-center logic.
3. `03-WORKFLOWS.md` — step-by-step workflows per actor (dispatcher, technician, accountant, admin/HR, call center), with the exact screens and transitions each role goes through.
4. `04-DESIGN.md` — UI/UX design system: layout, components, typography, color, and screen-level guidance for the Web ERP.
5. `05-MOBILE-DESIGN.md` — UI/UX design system for the companion mobile app: Dark OLED palette, single-hand thumb ergonomics, dual-persona navigation, offline caching, and micro-haptics.

---

## Project brief

Build a **web-based ERP for an HVAC (heating/ventilation/air-conditioning) service and installation company**, plus a **companion mobile app** used by technicians and staff. The system must cover, as one integrated platform (not bolted-together modules):

1. **Jobs / Dispatch** — call-in job creation, customer management, technician assignment, full job lifecycle including partial completion, care-of (subcontracted) jobs, and planned-vs-actual line items.
2. **Technician mobile app** — job execution, inventory requests/returns, expense claims, click-to-call, and a shared attendance mode (face recognition + geofence).
3. **HRM** — employees, attendance, payroll with a mandatory approval step, advances.
4. **Accounts/Finance** — a chart-of-accounts posting engine that every other module writes through; ledgers per customer/supplier/technician/care-of party; invoices and quotations.
5. **Purchasing & Inventory / POS** — PR → PO → GRN flow with per-product movement history, auto-sent supplier POs, and a POS that reuses the same invoicing/inventory services.
6. **Project Management** — BOQ-based projects for larger jobs, built on the same job/task primitives.
7. **Feedback / Call Center** — outbound quality-check calls to customers on completed jobs, capturing feedback and an approve/disapprove decision that feeds back into the job's verification state.
8. **Admin dashboard + live map** — KPIs, job funnel, and a live technician location map for assigning jobs in real time.

## Non-negotiable architectural principles

- **The accounts posting engine is the spine of the system.** No module (inventory, HRM, jobs) is allowed to mutate a ledger balance directly — every financial effect goes through a single posting service that writes `journal_entries`/`journal_lines`. This is the #1 rule; violating it is the fastest way to produce a system where the books don't reconcile.
- **Billing is always driven by actual, not planned, quantities.** Every job line item has a planned quantity and an actual quantity; invoices, inventory deductions, and cost postings use actual only. Planned is kept for audit/comparison.
- **One technician ledger, netted.** A technician's balance is a single running number combining what they owe the company (advances/hisaab given) and what the company owes them (expense reimbursements pending). Don't build these as two disconnected systems.
- **Every job state transition is logged immutably** (`job_status_history`) — this is what powers the admin dashboard, audit trail, and any future dispute resolution, so don't skip it to save a migration.
- **A job becomes read-only once the accountant finalizes it.** No further edits, only view + supervisor override with its own audit entry.
- **Admin verification and customer feedback are two independent gates on "done."** A job isn't truly closed until both the admin checklist and the call-center feedback outcome exist — a disapproval from either should be able to reopen/flag the job for review rather than silently pass through.
- **Don't build microservices or Kubernetes for this.** It's one company's internal ERP, not multi-tenant SaaS. A modular monolith (clear internal module boundaries for jobs/accounts/hrm/inventory) is correct scope. Split out a service only if a specific piece (e.g. face-recognition processing) genuinely needs independent scaling later.
- **Reuse, don't duplicate.** POS = invoicing + inventory ledger with a fast UI. PM/BOQ tasks = the Jobs state machine at a task level. Attendance = one face+geofence engine shared by the technician app and the general-staff app.

## Build order (do not reorder without reason)

1. Data model + accounts posting engine.
2. Jobs module (web/dispatcher side only).
3. Technician mobile app: job lifecycle + inventory request/return + expense claims.
4. Attendance (face + geofence) — can run in parallel with step 3.
5. Accounts/ledgers/invoicing wired to jobs.
6. HRM/payroll (depends on attendance + accounts).
7. Purchasing/inventory/POS.
8. Project management/BOQ.
9. Feedback/call-center module (depends on job verification being in place).

## Deliverable expectations

- Follow `02-LOGICS.md` exactly for state machines and posting rules — these encode real operational constraints from the business (e.g. a technician cannot resume a paused job until both stock return and hisaab are done), not arbitrary suggestions.
- Follow `03-WORKFLOWS.md` for the exact screens/buttons each role needs — the business already has a working manual process; the app should mirror it, not redesign it.
- Use the stack and hosting choices in `01-ARCHITECTURE.md` unless there's a concrete technical reason to deviate — flag any deviation explicitly rather than silently substituting.
