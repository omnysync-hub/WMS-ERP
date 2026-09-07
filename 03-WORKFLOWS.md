# DETAILED WORKFLOWS — HVAC Company ERP

Step-by-step, per role. Each step notes the screen/action and what it triggers in the backend.

---

## A. Dispatcher / CSR — Job Intake

1. Customer calls in. Dispatcher opens **New Job** screen.
2. Types into searchable customer field (typeahead by name/phone).
   - **Found** → selects, auto-fills phone/address/email.
   - **Not found** → taps **Add Customer**: enters name, phone, address (Google Places Autocomplete field — selecting a suggestion stores lat/lng), email. Saves, returns to job form with customer pre-filled.
3. System shows auto-generated `job_number` (read-only).
4. Selects **job type**, enters **remarks**.
5. Adds **job items**: description, `quantity_planned`, `unit_rate` (one or more lines — e.g. "AC unit install ×10 @ rate").
6. Toggles **Care Of** if this is a subcontracted job for another company:
   - Enters `care_of_company`, `care_of_person`, optional `manual_job_number`.
7. Saves → job status `Created`.
8. Assigns technician (dropdown, or from the **live map view** — see Admin section) → status `Assigned` → WhatsApp message + push notification auto-sent to technician.

---

## B. Technician — Mobile App, Job Execution

1. Receives WhatsApp message + app push for new job.
2. Opens app → **My Jobs** list → taps the job → sees customer, address (tap to open in maps for navigation), job items, care-of info if applicable.
3. Taps **Accept** → status `Accepted`.
4. Arrives on site, taps **Start Job** → status `InProgress` (GPS + timestamp logged).
5. Mid-job, if more materials are needed: taps **Request Inventory** → form (item, qty, note) → sent to store, notification to store keeper.
6. If job won't finish today: taps **Stop Job** → app shows a **mandatory checklist** before this is allowed to close out:
   - **Return Inventory**: enter items/qty being returned → sent to store for acknowledgment.
   - **Go to Accountant for Hisaab**: app shows "pending settlement" badge on the job until accountant records it (see Accountant workflow below). Technician physically goes to the accountant.
   - Once both are marked done (server-side, not just locally), status → `Paused`, and **Resume** becomes available (next day).
7. If a **customer requests a discount** mid-job: technician taps **Call Accountant** (in-app click-to-call, logged against the job) → discusses off-app → accountant applies discount in their own screen → technician's job screen updates live to show the reduced expected amount.
8. During or after the job, technician can **Log Expense** (amount, note, optional photo of receipt) any time — tagged to the job, queued for reimbursement at next hisaab.
9. When work is actually finished: taps **Complete Job** → app forces entry of `quantity_actual` for every job item (defaults blank, must be filled) → status `CompletedPendingVerification`. This also triggers the final hisaab requirement (must go to accountant).

---

## C. Accountant — Hisaab / Settlement

Triggered either by a `Paused` job (partial day) or a `CompletedPendingVerification` job (job finished).

1. Opens **Pending Settlements** queue → selects the job/technician.
2. System shows computed `amount_expected` (sum of `quantity_actual × unit_rate`, minus any discount already applied).
3. **If mid-job discount requested by phone**: accountant enters `discount_amount` + reason here (this is the only place discounts are entered) → reflected instantly on technician's app.
4. Records `amount_collected` from customer:
   - Full → `is_full = true`.
   - Partial → `is_full = false`, system computes `balance_due`, accountant optionally sets `next_visit_date`.
5. Reviews technician's **pending expense claims** for this job:
   - Has cash → marks **Paid**, hands over cash.
   - No cash → leaves **Pending** (carries onto technician's ledger, settled later).
6. Confirms **stock return** was acknowledged by store (if applicable to this session).
7. If this is the final hisaab for a `CompletedPendingVerification` job: taps **Finalize Job** → job becomes read-only, moves to admin's verification queue.
8. If this was just a `Paused`-cycle hisaab (job continues tomorrow): saves settlement, job stays `Paused` until technician resumes.

---

## D. Admin / Supervisor — Verification & Oversight

1. **Verification queue**: sees all `CompletedPendingVerification`/`Finalized` jobs awaiting approval.
2. Opens a job, checklist: work confirmed / payment reconciled / inventory returned — ticks each, or flags an issue (sends back with a note, does not silently edit a finalized job).
3. Approves → status `Verified` (terminal).
4. **Dashboard**: jobs done vs. pending, revenue collected vs. expected, technician performance (jobs completed, average time, collection rate).
5. **Live map**: sees all technicians' current locations (from background GPS pings) — can assign a newly created job to whichever technician is closest/free directly from the map.
6. **Chart of accounts / reports**: drills into any ledger — customer, care-of party, supplier, technician — all sourced from the same `journal_lines` via the posting engine, so numbers always tie back to source jobs/transactions.

---

## E. Store Keeper — Inventory Requests & Returns

1. Sees incoming **Inventory Requests** from technicians (from step B.5) → fulfills, marks issued (posts stock-out).
2. Sees incoming **Stock Returns** (from step B.6) → verifies physically, acknowledges → posts stock back in.
3. Raises **Purchase Requisitions** when stock is low (or system auto-flags via `reorder_level`) → goes to PR approval → PO → sent to supplier → GRN on receipt.

---

## F. HR / Payroll

1. **Attendance**: all employees (technicians and others) use the shared app tab — face capture + geofence check, twice daily (in/out). Failed attempts are logged and visible to HR for follow-up (not silently dropped).
2. **Advances**: HR/accountant can record an advance to an employee → posts to their ledger (technician ledger if a technician, general employee ledger otherwise).
3. **Payroll run**:
   - HR triggers **Calculate Payroll** for a period → system computes gross, deducts advances/loans, nets in any pending technician `expense_owed`/`expense_paid` per policy → status `Draft`.
   - A separate approver reviews and taps **Approve** → status `Approved`.
   - Finance taps **Run/Pay** → posts to accounts, generates payslips → status `Paid`.

---

## G. Sales/Accounts — Quotations, Invoices, POS

1. **Quotation**: created standalone or from a Project's BOQ → converts to a Job (with job_items pre-filled from the quotation) once approved by customer.
2. **Invoice**: auto-generated from a job's finalized `job_items` (actual quantities), or created standalone for non-job sales.
3. **POS**: a fast-entry invoice screen — select products, quantities, generates invoice + deducts stock immediately, same posting path as job consumption.

---

## H. Purchasing — PR → PO → GRN

1. PR raised (by store keeper, low stock, or technician's inventory request rolling up) → routed for approval.
2. Approved PR → converted to **PO** → auto-emailed/PDF sent to supplier.
3. Supplier delivers → **GRN** recorded (quantity received, matched against PO) → posts inventory asset debit / accounts payable credit.
4. Supplier invoice arrives → matched against PO + GRN (3-way match) before payment is released.

---

## I. Call Center — Feedback

1. Job reaches `Verified` → automatically appears in the agent's **Feedback Queue** (no manual routing needed).
2. Agent opens the job, sees customer name/phone/job summary, taps **Call** (click-to-call or just dials).
3. Records the call outcome:
   - **Approved** — customer happy, taps Approve, optional remarks.
   - **Disapproved** — customer unhappy, taps Disapprove, **remarks required** (what went wrong), flags the job for admin review.
   - **No Answer / Reschedule** — sets a `follow_up_date`, job stays in queue and resurfaces on that date.
4. Disapproved jobs appear on the **Admin dashboard** under a "Needs Review" list, separate from the normal done/pending counts, so quality issues can't get buried in the general job list.
5. Approval/disapproval rates roll up per technician on the technician performance dashboard, and company-wide as a customer satisfaction metric.

---

## J. Project Management (BOQ) — Larger Jobs

1. **Project** created with a **BOQ**: line items (description, unit, qty, rate) — essentially a large-scale version of `job_items`.
2. BOQ lines break down into **tasks**, each reusing the Job state machine (Assigned → InProgress → Completed → Verified) at task granularity.
3. Billing can be **milestone-based**: invoice generated as a percentage of BOQ value tied to completed/verified tasks, rather than one invoice at the end.
