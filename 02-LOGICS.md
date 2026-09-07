# LOGICS — HVAC Company ERP

Core business rules. Anything ambiguous in the workflows doc should resolve back to these rules.

## 1. Job state machine

```
Created
  → Assigned (dispatcher assigns technician; triggers WhatsApp + push)
  → Accepted (technician accepts)
  → InProgress (technician starts; GPS + timestamp captured)
  → Paused (technician stops, day not finished)
       → [MANDATORY sub-flow before resume is allowed]:
            1. StockReturn recorded + acknowledged by store keeper
            2. HisaabSettlement recorded by accountant (full or partial)
       → InProgress (resume, next day)
  → CompletedPendingVerification (technician taps Complete)
  → Finalized (accountant locks the job — read-only from here)
  → Verified (admin/supervisor approves — final state)
```

**Rules:**
- The `Resume` action is **disabled** in the app until both `StockReturn.acknowledged_at` and `HisaabSettlement` exist for that pause cycle. Enforce this server-side, not just in the UI (technician's app should not be trusted as the source of truth for whether the gate is satisfied).
- Every transition writes a `job_status_history` row: `from_status`, `to_status`, `changed_by`, `changed_at`, and a `meta_json` for context (e.g. GPS coords on start, discount applied on pause).
- `Finalized` sets `finalized_at` and flips the job to read-only at the API layer — reject any PATCH to a finalized job except from a supervisor-override endpoint, which itself logs a `job_status_history` entry with reason.
- `Verified` is a checklist-gated approval (work confirmed / payment reconciled / inventory returned) — store which checklist items were ticked, by whom.
- `Verified` is not the final word on quality: it triggers a `feedback_calls` task for the call center (see Section 9). A customer **disapproval** should be able to flag the job back to admin for review — model this as a separate `quality_flag` on the job rather than reversing the state machine, so financial postings already made aren't disturbed by a quality issue.

## 2. Planned vs. actual quantities (billing & inventory truth)

- Every `job_item` has `quantity_planned` (set at job creation, from what the customer asked for) and `quantity_actual` (set at job completion, from what was really done).
- **Invoicing always uses `quantity_actual × unit_rate`.** Never planned. If `quantity_actual` is null when the technician taps Complete, block completion — force it to be filled (even if equal to planned).
- **Inventory deduction always uses `quantity_actual`.** The difference (`quantity_planned - quantity_actual`, if positive) is exactly what should show up as returnable stock in the `StockReturn` flow — compute it, don't ask the technician to re-enter it.
- Keep `quantity_planned` on the record permanently for audit/comparison reporting ("planned vs delivered" dashboard).

## 3. Accounts posting engine

- Single service: `AccountsPostingService.post({ date, memo, ref_type, ref_id, lines: [{account_id, debit, credit}] })`. Every call must balance (sum debit = sum credit) — reject otherwise.
- Every module that has a financial effect calls this — nothing writes to `journal_lines` directly.
- Examples of what posts through it:
  - Job completion revenue recognition (debit AR/cash, credit revenue) using `quantity_actual`.
  - Inventory consumption on a job (debit COGS, credit inventory asset) — actual quantity only.
  - Technician advance given (debit technician receivable, credit cash).
  - Technician expense reimbursement paid (debit technician expense/COGS, credit cash) — or, if deferred, (debit technician expense, credit technician payable).
  - Discount given mid-job (debit discount/contra-revenue, credit AR) — only after accountant approval.
  - Payroll run (debit salary expense, credit cash/bank, credit any advance recovery).
  - Purchase GRN (debit inventory asset, credit accounts payable).

## 4. Hisaab (settlement) logic

At every `Paused` or `CompletedPendingVerification` hisaab session, the accountant handles **two independent flows** in the same session:

**A. Payment collected from customer**
- `amount_expected` = sum of `job_items.quantity_actual × unit_rate` minus any approved discount.
- `amount_collected` — accountant records what was actually handed over.
- If `amount_collected < amount_expected` → `is_full = false`, `balance_due = amount_expected - amount_collected`, optional `next_visit_date` for follow-up collection.
- Discount mid-job: technician calls accountant from the app → accountant enters a `discount_amount` against the job (with a reason code) → this reduces `amount_expected` and is visible to the technician's app in real time (push/poll the job record). Discounts should require accountant role, never technician self-service.

**B. Technician expense reimbursement**
- Technician logs `job_expense_claims` (amount, note, optional receipt photo) any time during the job — not only at hisaab, but they're *settled* at hisaab.
- At settlement, accountant reviews pending claims for that job/technician:
  - If cash available → mark `paid`, post `expense_paid` entry, physically hand over cash.
  - If cash not available → leave `pending`, which creates a `technician_ledger_entries` row of type `expense_owed` — carried forward, settled whenever cash is available (next day, or netted into next payroll run).

**C. Technician running balance (single number)**
- `technician_ledger_entries` types: `advance` (+owed to company), `hisaab_given` (+owed to company, if applicable to your business — e.g. float given for parts), `expense_owed` (−owed to company, i.e. company owes them), `expense_paid` (clears the `expense_owed`).
- Balance = sum of all entries for that technician. Positive = technician owes company; negative = company owes technician. Show this single netted number on the technician's ledger view — don't force accountants to manually net two separate reports.

## 5. Attendance logic (face + geofence)

- Enrollment: capture face template once per employee (consent required, store securely).
- Each check-in: capture live face photo → match against stored template (similarity score threshold, e.g. ≥ 90%) **AND** capture GPS → must fall inside a registered `geofence_zone` (office/site, radius-based) at time of check-in.
- Both conditions must pass for `result = pass`; log every attempt (pass or fail) to `attendance_logs` for audit — don't only log successes, or you can't investigate disputes.
- Technicians use the same engine but may have job-site geofences in addition to the office, if the business wants field check-ins recognized (clarify with stakeholders whether technician attendance is office-only or also site-based; default assumption here is office-only for attendance, separate from job GPS tracking).

## 6. Payroll logic

- `payroll_runs`: `Draft` (calculated, not visible to employees) → `Approved` (role-gated approval action, logs approver) → `Paid` (posts to accounts, generates payslips).
- Advances and pending `expense_owed`/`expense_paid` ledger entries for technicians should be netted into the payroll run automatically where the business wants that (confirm policy: are technician expense reimbursements paid same-day in cash, or can they roll into payroll? Build to support both, default to same-day cash per the hisaab flow above, payroll only for salary + advance recovery).

## 7. Purchasing logic

- `PR` (requisition, can be raised by store/technician need) → approval → `PO` (auto-generated PDF, auto-emailed to supplier) → `GRN` (goods receipt, posts inventory asset debit / AP credit) → supplier invoice matched against PO+GRN before payment.
- Every product's full history (PR→PO→GRN→consumption→return) should be queryable as one timeline per `product_id`.

## 8. Feedback / Call Center logic

- Every job that reaches `Verified` automatically enters a **Feedback Queue** for the call center — no manual step needed to create the task.
- Call center agent calls the customer, records:
  - `outcome`: `approved`, `disapproved`, `no_answer`, `rescheduled`.
  - `remarks`: free text (what the customer said).
  - `follow_up_date`: required if `no_answer` or `rescheduled`, so the call resurfaces in the queue automatically rather than being lost.
- **Approved** → job's `quality_flag` = clean; no further action, feeds the technician/company satisfaction dashboard.
- **Disapproved** → sets `quality_flag = disputed` on the job, notifies admin/supervisor, and surfaces on the admin dashboard as needing review. This does **not** unwind any accounts postings automatically — a human (admin) decides next steps (redo the job, partial refund, etc.), and any financial correction goes through the normal posting engine as a new entry, never a silent edit to history.
- Feedback outcomes roll up into the technician performance dashboard (approval rate per technician) and a company-wide customer satisfaction metric.

## 9. POS logic

- POS sale = an invoice + inventory deduction, generated instantly, using the same `AccountsPostingService` and `stock_ledger` write path as job consumption — do not build a parallel inventory-deduction mechanism for POS.
