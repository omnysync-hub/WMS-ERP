# ARCHITECTURE — HVAC Company ERP

## 1. System overview

A modular monolith backend, a Next.js web ERP for staff (dispatcher/accountant/admin/HR), and a single React Native mobile app that serves two roles: **technician app** and **general staff attendance app**. All financial effects flow through one accounts posting service.

```
                         ┌────────────────────┐
                         │   Next.js Web ERP   │  (dispatcher/accountant/admin/HR)
                         └─────────┬───────────┘
                                   │ REST/GraphQL
                    ┌──────────────┴───────────────┐
                    │        Backend API           │
                    │  (NestJS or Django, modular)  │
                    │                               │
                    │  Jobs | HRM | Accounts |      │
                    │  Purchasing/Inventory |       │
                    │  PM/BOQ | Attendance          │
                    │                               │
                    │  ── all financial writes ──►  │
                    │      Accounts Posting Engine  │
                    └──────────────┬────────────────┘
                                   │
                 ┌─────────────────┼───────────────────┐
                 │                 │                   │
          PostgreSQL (RDS)   Redis (queues/pubsub)   S3/R2 (files)
                 │
        ┌────────┴─────────┐
        │  External services │
        │  Google Maps API   │
        │  WhatsApp Cloud API│
        │  FCM push          │
        │  Face-recognition  │
        │  (Rekognition/Azure)│
        └────────────────────┘

                         ┌────────────────────┐
                         │  Mobile App (RN)     │  (technician + staff attendance)
                         └────────────────────┘
```

## 2. Module boundaries (internal, within one codebase)

| Module | Owns | Depends on |
|---|---|---|
| `jobs` | Job, JobItem, JobStatusHistory, InventoryRequest, StockReturn, HisaabSettlement | `customers`, `accounts` (posting), `inventory` |
| `customers` | Customer, CareOfParty | — |
| `technicians` | Technician profile, location pings, ledger balance (derived) | `accounts` |
| `hrm` | Employee, Attendance, Payroll, Advance | `accounts` (posting) |
| `accounts` | ChartOfAccounts, JournalEntry, JournalLine, Invoice, Quotation | — (the spine; nothing depends on it circularly) |
| `purchasing_inventory` | Product, PR, PO, GRN, StockLedger, POS Sale | `accounts` (posting) |
| `project_management` | Project, BOQItem, ProjectTask (reuses Job state machine) | `jobs`, `accounts` |
| `attendance` | FaceTemplate, GeofenceZone, AttendanceLog | `hrm` |
| `feedback` | FeedbackCall, FeedbackOutcome | `jobs` |

**Rule:** every module that has a financial effect calls `AccountsPostingService.post(entry)` — it never writes to `journal_lines` itself, and it never adjusts another module's tables directly (e.g. `jobs` doesn't touch `stock_ledger` rows — it calls an `InventoryService` method, which itself posts through accounts).

## 3. Data model overview (core entities)

- `customers(id, name, phone, email, address_text, lat, lng)`
- `care_of_parties(id, company_name, person_name)`
- `jobs(id, job_number, customer_id, care_of_party_id NULL, manual_job_number NULL, job_type, remarks, status, assigned_technician_id, created_at, finalized_at NULL)`
- `job_items(id, job_id, description, quantity_planned, quantity_actual NULL, unit_rate)`
- `job_status_history(id, job_id, from_status, to_status, changed_by, changed_at, meta_json)`
- `inventory_requests(id, job_id, technician_id, item, qty_requested, status)`
- `stock_returns(id, job_id, technician_id, item, qty_returned, acknowledged_by, acknowledged_at)`
- `job_expense_claims(id, job_id, technician_id, amount, note, receipt_url NULL, status[pending/paid], paid_at NULL)`
- `hisaab_settlements(id, job_id, technician_id, amount_collected, amount_expected, is_full, balance_due, next_visit_date NULL, discount_amount NULL, settled_by, settled_at)`
- `technician_ledger_entries(id, technician_id, type[advance/hisaab_given/expense_owed/expense_paid], amount, ref_job_id NULL, created_at)` — running balance is a derived sum.
- `chart_of_accounts(id, code, name, type)`
- `journal_entries(id, date, memo, ref_type, ref_id)`
- `journal_lines(id, journal_entry_id, account_id, debit, credit)`
- `products(id, sku, name, unit, reorder_level)`
- `stock_ledger(id, product_id, qty, direction[in/out], ref_type, ref_id, created_at)`
- `purchase_requisitions`, `purchase_orders`, `goods_receipts` — standard PR→PO→GRN chain, each linked to `stock_ledger` entries on receipt.
- `employees`, `attendance_logs(id, employee_id, timestamp, face_match_score, lat, lng, geofence_zone_id, result[pass/fail])`
- `feedback_calls(id, job_id, called_by, called_at, outcome[approved/disapproved/no_answer/rescheduled], remarks, follow_up_date NULL)`
- `payroll_runs(id, period, status[draft/approved/paid], approved_by, approved_at)`, `payslips`

## 4. Tech stack

| Layer | Choice | Rationale |
|---|---|---|
| Backend API | **NestJS (TypeScript)** or Django/DRF | NestJS if team is JS-heavy end-to-end (shared language with web+mobile); Django for batteries-included admin/migrations. |
| Database | **PostgreSQL** | Relational integrity is essential for ledgers, stock, job states. |
| Web ERP | **Next.js + TypeScript + Tailwind** | Matches existing TCE work; SSR for dashboards. |
| Mobile app | **React Native (Expo)** | One codebase, shared language with NestJS backend. |
| Real-time (live map, notifications) | **Socket.IO** or managed pub/sub (Pusher/Ably) | Simple pub/sub for GPS pings and job-assignment pushes; no need for Kafka at this scale. |
| Face recognition | **AWS Rekognition** or **Azure Face API** | Managed, avoids GPU ops burden. |
| Maps/geocoding | **Google Maps Platform** (Places Autocomplete, Geocoding, Maps SDK) | |
| WhatsApp | **WhatsApp Business Cloud API** via Twilio or Gupshup | Easier onboarding than raw Meta API. |
| Push notifications | **Firebase Cloud Messaging** | |
| File storage | **AWS S3** or **Cloudflare R2** | Job photos, receipts, invoices/POs. |
| Queues/background jobs | **BullMQ** (Node) or **Celery** (Python) + Redis | PO emails, WhatsApp sends, payroll runs. |
| PDF generation | **Puppeteer/Playwright** or `pdf-lib`/WeasyPrint | Invoices, POs, payslips. |

## 5. Hosting plan

| Component | Host | Notes |
|---|---|---|
| Backend API | AWS ECS Fargate (or Railway/Render for MVP) | Move to Fargate once queues/workers need independent scaling. |
| PostgreSQL | AWS RDS or Supabase | Managed backups/failover — never self-host the primary DB. |
| Redis | AWS ElastiCache or Upstash | |
| Web frontend | Vercel | Best-fit for Next.js. |
| File storage | Cloudflare R2 or AWS S3 | R2 for lower egress cost. |
| Mobile builds | Expo EAS | |
| Face recognition | AWS Rekognition (API call, no hosting) | |
| WhatsApp/SMS | Twilio/Gupshup (SaaS) | |
| Monitoring | Sentry + CloudWatch/Better Stack | Non-negotiable given money + payroll flow through this system. |

## 6. Security & compliance notes

- Face template data and biometric logs are sensitive — encrypt at rest, restrict access by role, and get explicit written consent from employees before enrolling them.
- Background GPS tracking of technicians during shift hours needs clear consent language and should stop tracking outside shift hours.
- Role-based access control (RBAC) across dispatcher / technician / accountant / admin / HR — every endpoint should check role, not just authentication.
