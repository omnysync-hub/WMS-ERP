# Workman Services Financial System Guide

## 1. Financial architecture

The general ledger is the financial source of truth. Every money event is translated into a balanced journal by `AccountsPostingService.post()`. Each journal has a header (`JournalEntry`) and at least two immutable debit/credit lines (`JournalLine`). Posted entries are not edited or deleted in normal operation; corrections use an equal-and-opposite reversal journal.

The operational modules (jobs, inventory, procurement, POS, payroll, HRM, projects, tax and cashbook) do not choose hard-coded ledgers for normal postings. They request an accounting role from `AccountMappingService`, such as `job_revenue_receivable` or `vendor_payment_payable`. The mapping selects the concrete level-4 account. This lets an administrator change the posting destination without changing program code, while type validation prevents an asset role from being mapped to a revenue or liability account.

The system contains four related books:

1. **General ledger:** all posted journals and journal lines.
2. **Customer and vendor sub-ledgers:** party-by-party AR/AP detail tied back to the GL control accounts.
3. **Technician ledger:** advances, collections, expenses owed/paid and recoveries used for daily hisaab and payroll netting.
4. **Stock ledger:** physical quantity movements. Financial inventory value is recorded separately in the GL.

Only journal statuses `posted` and `reversal` affect financial statements. `pending_approval`, `draft` and `reversed` headers are excluded. A reversed original is excluded while its equal-and-opposite reversal remains included, producing a net zero effect.

## 2. Default chart of accounts

| Code | Account | Normal balance | Purpose |
|---|---|---:|---|
| 1000 | Cash on Hand / Main Drawer | Debit | Cash receipts and cash payments |
| 1010 | Operating Bank Account (Meezan) | Debit | Default bank receipts/disbursements |
| 1011 | Secondary Bank Account (HBL) | Debit | Alternate bank selected by the user |
| 1020 | Petty Cash Float | Debit | Small office/field payments |
| 1100 | Accounts Receivable | Debit | Customer invoices less receipts |
| 1150 | Employee & Technician Advances | Debit | Recoverable staff/technician advances |
| 1200 | Inventory Asset | Debit | Cost value of warehouse stock |
| 1500 | Fixed Asset Cost | Debit | Capitalized fixed assets |
| 1590 | Accumulated Depreciation | Credit | Contra-asset depreciation reserve |
| 2000 | Accounts Payable | Credit | Approved vendor invoices less payments |
| 2050 | GR/IR Clearing | Credit | Goods received but not yet vendor-invoiced |
| 2100 | Technician Payable | Credit | Approved technician expenses still owed |
| 2200 | Withholding Tax Payable | Credit | Tax withheld from vendors and owed to FBR |
| 3000 | Owner Capital | Credit | Opening stock/capital offset |
| 3200 | Retained Earnings | Credit | Closed profit or loss from prior years |
| 3900 | Opening Balance Equity | Credit | Go-live trial-balance offset |
| 4000 | Service / Sales Revenue | Credit | Job, project and POS revenue |
| 4100 | Discounts Allowed | Debit | Contra-revenue for approved discounts |
| 5000 | Cost of Goods Sold | Debit | Inventory cost consumed/sold |
| 5050 | Purchase Price Variance | Debit or credit | Difference between receipt and vendor invoice |
| 6000 | Salaries & Wages | Debit | Gross payroll and final-settlement salary cost |
| 6100 | Technician Travel & Field Expense | Debit | Reimbursements and field expenses |
| 6200 | General Overheads | Debit | Default cashbook/office expense |
| 6350 | Depreciation Expense | Debit | Monthly fixed-asset depreciation |

The hierarchy contains group accounts above these posting accounts. Journals and mappings must use active level-4 accounts, never a group/summary node.

## 3. Transaction-to-ledger matrix

### Sales, jobs, projects and customer money

| Business event | Debit | Credit | Other records |
|---|---|---|---|
| Finalize job / raise job invoice | 1100 AR (`job_revenue_receivable`) for net invoice; 4100 Discounts for approved discount | 4000 Revenue (`job_revenue_sales`) for gross revenue | Invoice + customer sub-ledger invoice |
| Re-finalize changed job | New correct revenue journal after reversing the old journal | Equal-and-opposite reversal of old journal | Invoice updated; customer sub-ledger gets debit/credit adjustment for the exact delta |
| Project progress invoice | 1100 AR | 4000 Revenue | Project invoice, billed milestone, project invoiced total and customer sub-ledger, all atomically |
| Customer payment | 1000/selected bank (`customer_payment_receiving`) | 1100 AR (`customer_payment_receivable`) | Invoice status/project paid amount + customer sub-ledger payment |
| Technician hands customer cash to accounts | 1000/selected vault (`settlement_collection_vault`) | 1100 AR (`settlement_collection_receivable`) | Hisaab settlement + technician ledger + customer sub-ledger |
| POS cash sale | 1000 Cash | 4000 Revenue | POS sale and sale items |
| POS bank/card sale | 1010 Bank | 4000 Revenue | POS sale and sale items |
| POS credit sale | 1100 AR | 4000 Revenue | POS sale and sale items |

### Inventory and cost of sales

| Business event | Debit | Credit | Other records |
|---|---|---|---|
| Issue stock to a job or POS | 5000 COGS (`inventory_cogs_expense`) | 1200 Inventory (`inventory_cogs_asset`) | Product quantity decreases + stock-ledger OUT |
| Return unused stock | 1200 Inventory (`inventory_return_asset`) | 5000 COGS (`inventory_return_cogs`) | Product quantity increases + stock-ledger IN |
| Direct cash stock purchase | 1200 Inventory (`stock_in_asset`) | 1000/selected cash or bank (`stock_in_disbursing`) | Product quantity increases + stock-ledger IN |
| Opening stock | 1200 Inventory (`opening_stock_asset`) | 3000 Capital (`opening_stock_equity`) | Opening quantity + stock-ledger IN |
| Goods receipt against PO | 1200 Inventory (`grn_receipt_asset`) | 2050 GR/IR (`grn_receipt_clearing`) | GRN, accepted quantity, PO received quantity and stock ledger |

Quantities and GL postings are committed in one database transaction for the guarded inventory flows. If stock is insufficient, an account mapping is missing, or the journal fails, none of the stock mutation is retained.

### Procurement, vendors and tax

| Business event | Debit | Credit | Other records |
|---|---|---|---|
| Approved vendor invoice matched to GRN | 2050 GR/IR for received value; 5050 PPV for unfavorable variance | 2000 AP for invoice liability; 5050 PPV for favorable variance | Supplier invoice + vendor sub-ledger bill |
| Vendor payment without WHT | 2000 AP | Selected bank/cash (`vendor_payment_disbursing`) | Supplier payment + invoice paid amount/status + vendor sub-ledger payment |
| Vendor payment with WHT | 2000 AP for gross settled | Bank for net cash; 2200 WHT Payable for withheld tax | Vendor sub-ledger reduced by gross amount; CPR/WHT data retained |
| Direct vendor payment journal | 2000 AP | Selected bank/cash | GL-only cashbook-style supplier payment when no vendor invoice is selected |

Example: a PKR 100,000 vendor liability paid with 10% WHT posts Dr AP 100,000, Cr Bank 90,000, Cr WHT Payable 10,000. The vendor is cleared by 100,000; the company still owes 10,000 to the tax authority.

### Payroll, staff advances and technician hisaab

| Business event | Debit | Credit | Other records |
|---|---|---|---|
| Payroll disbursement | 6000 Salary Expense (plus technician payable clearance where applicable) | Cash/bank for net pay; 1150 Advance Receivable for deductions | Payslips paid, advances recovered, technician expense balances settled |
| Employee/technician advance | 1150 Employee Advances | 1000/selected cash/bank | Employee advance + technician ledger entry when employee is a technician |
| Technician expense paid immediately | 6100 Field Expense | 1000/selected cash/bank | Technician ledger `expense_paid` |
| Approved expense not yet paid | 6100 Field Expense | 2100 Technician Payable | Technician ledger `expense_owed` |
| Pay accrued technician expense | 2100 Technician Payable | Cash/bank | Technician ledger settlement |
| Final employee settlement | Salary/settlement expense | Advance recovery and cash/bank net payment | Final settlement record and employee offboarding state |

### Fixed assets, opening balances and period close

| Business event | Debit | Credit |
|---|---|---|
| Fixed-asset acquisition/register cost | 1500 Fixed Asset Cost | Funding/AP account supplied by acquisition flow |
| Monthly depreciation | 6350 Depreciation Expense | 1590 Accumulated Depreciation |
| Opening debit balances | Imported asset/expense account | 3900 Opening Balance Equity |
| Opening credit balances | 3900 Opening Balance Equity | Imported liability/equity/revenue account |
| Year-end profit close | Revenue accounts (to zero them) | Expense accounts (to zero them) and 3200 Retained Earnings for profit |
| Year-end loss close | Revenue accounts and 3200 Retained Earnings | Expense accounts |

## 4. Posting controls

Before a journal is stored, the posting engine enforces:

- at least two lines;
- finite, non-negative amounts;
- exactly one debit or credit side per line;
- at least one cent per line;
- exact equality of debit cents and credit cents after line rounding;
- existence and active status of every account;
- fiscal-period lock/close rules;
- atomic journal, lines and financial audit-log creation.

Reversals swap every debit and credit, reference the original journal, mark the original `reversed`, and create a financial audit entry. The original financial history remains visible and immutable.

## 5. Account mapping controls

There are 48 defined accounting roles. The standard mapping is:

- **Sales:** AR 1100, revenue 4000, discounts 4100, receipts 1000, receipt offset 1100.
- **Inventory:** COGS 5000, inventory 1200, direct-purchase cash 1000, opening-stock equity 3000.
- **Procurement:** receipt inventory 1200, GR/IR 2050, AP 2000, PPV 5050, payment bank 1010, WHT 2200.
- **Payroll/HR:** salary 6000, payroll cash 1000, advance receivable/recovery 1150.
- **POS/field:** cash 1000, bank 1010, AR 1100, revenue 4000, field expense 6100, technician payable 2100.
- **Close/reconciliation:** fixed asset 1500, operating bank 1010, AR control 1100, AP control 2000, depreciation 6350/1590, retained earnings 3200, opening equity 3900.

Resolution fails closed when the role is missing, the account is inactive, the account is not level 4, or its account type is incompatible with the role. Category-scoped mappings may override the default mapping for a job/service category; otherwise the unscoped company default is used.

## 6. Sub-ledgers and reconciliation

Customer balance uses `previous balance + debit - credit`. Vendor balance uses `previous balance + credit - debit`. Entries require one positive side, finite values and a document number. Stable date/creation/id ordering determines the latest balance.

The reconciliation report compares:

- total customer latest balances against the mapped 1100 AR GL balance; and
- total vendor latest balances against the mapped 2000 AP GL balance.

Any difference above PKR 0.01 is reported as drift. AR/AP operational flows should commit the journal and sub-ledger entry in the same transaction so drift cannot be created by a partial failure.

## 7. Financial statements

- **Trial balance:** all active accounts, using posted/reversal lines through the selected date. Assets, expenses and contra-revenue have debit-normal balances; liabilities, equity and revenue have credit-normal balances.
- **Balance sheet:** assets versus liabilities plus equity. Unclosed current-period income is added to equity.
- **Income statement:** revenue less discounts, COGS (5xxx) and operating expenses (6xxx).
- **Cash flow:** indirect operating cash flow begins with net income, adds depreciation, then adjusts for AR, inventory and AP movements. Cash/bank ending balance is derived from posted ledger lines.
- **AR/AP aging:** outstanding party balances are distributed into current, 31–60, 61–90 and 90+ day buckets.

## 8. Accounting onboarding workflow

During setup, the customer may start from the Workman template, import an existing Chart of Accounts, or build custom level-4 accounts. The Account Mapping worksheet then displays every Workman money transaction as a row with its normal debit/credit behavior, compatible account classification and selected customer ledger account.

For each row, the customer can reuse an existing compatible account or choose **Create & map**. That action creates a custom level-4 account and binds it to the transaction role atomically. If either operation fails, both are rolled back. One account may be reused for several related roles, while category-scoped mappings can split transactions when the business needs more detailed reporting.

Go-live remains blocked until all required roles are mapped, all selected accounts are active compatible posting accounts, and opening balances produce a balanced trial balance.

## 9. Operational rule of thumb

For every money event, confirm four questions: (1) what business document was created, (2) which account is debited, (3) which account is credited, and (4) which sub-ledger or stock/technician ledger must move with it. If any required part cannot be written, the entire event must roll back and return an explicit error.
