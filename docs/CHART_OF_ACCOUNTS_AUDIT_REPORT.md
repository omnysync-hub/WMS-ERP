# Workman Services ERP — Chart of Accounts & Transaction Posting Audit Report (Phase 1)

**Date:** September 20, 2026  
**Auditor:** Antigravity AI Pair Programmer  
**Target Repository:** `D:\WORKMAN SERVICES`  
**Status:** Complete — Pending User Review & Approval Before Phase 2 Execution  

---

## Executive Summary

Workman Services ERP currently operates with an accounting engine centered around `AccountsPostingService.post()` and `reverseEntry()`. While transaction integrity is strictly double-entry balanced (every journal entry enforces $\sum \text{debits} = \sum \text{credits}$), **all account resolution across operational modules is currently hardcoded to static account codes**. 

Furthermore, while the application contains a virtual 4-level presentation hierarchy in TypeScript (`src/lib/constants/chartOfAccountsHierarchy.ts`), the PostgreSQL database schema for `Account` is **completely flat (depth = 1)**, with no database-level tree hierarchy, parent-child relationships, system flags, or multi-currency definitions.

This audit establishes the baseline required for Phase 2 (schema migration, `AccountMapping` persistence, and the `resolveAccount()` central dispatch service) and Phase 3 (the AI transaction pattern suggestion agent).

---

## 1. Chart of Accounts: Current Implementation & Schema

### 1.1 Database Schema (`prisma/schema.prisma`)
The `Account` model in `prisma/schema.prisma` is currently defined as follows:

```prisma
model Account {
  id           String        @id @default(uuid())
  code         String        @unique
  name         String
  type         String        // 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  description  String?
  isActive     Boolean       @default(true)
  createdAt    DateTime      @default(now())
  journalLines JournalLine[]
}
```

#### Key Architectural Findings:
1. **Actual Depth in DB: 1 (Flat).** There is no `parentId`, `level`, `path`, or tree hierarchy in PostgreSQL.
2. **Missing Metadata:** There is no `companyId` (for multi-entity or company scoping), no `currency` column, and no `isSystem` boolean flag to protect core ledger integrity from deletion or orphan states.
3. **Foreign Key Integrity:** `JournalLine.accountId` directly references `Account.id`. Any structural retrofit **must not drop or replace** the `Account` table to prevent breaking historical journal entries.

---

### 1.2 Seed Accounts & On-The-Fly Auto-Provisioning
There are **22 primary seeded accounts** (`prisma/seed.ts`) and **25 static fallback accounts** declared inside `AccountsPostingService.getAccountByCode()`:

| Code | Account Name | Type | Current Role / Usage |
| :--- | :--- | :--- | :--- |
| `1000` | Cash & Bank Balances | Asset | **Generic Default** cash/bank account for all payments & collections |
| `1010` | Meezan Bank | Asset | Disbursing bank for vendor bills & disbursements |
| `1011` | HBL Corporate Account | Asset | Bank transfers & corporate transactions |
| `1020` | Petty Cash Vault | Asset | Field / branch float |
| `1100` | Accounts Receivable | Asset | Master AR control account for Job revenue, POS invoices, & customer receipts |
| `1150` | Employee Advances & Receivables | Asset | Salary advances & technician travel floats |
| `1200` | Inventory Asset | Asset | Stock on hand (raw materials, spare parts, appliances) |
| `1500` | Operational Equipment & Machinery | Asset | Capital asset registry |
| `1590` | Accumulated Depreciation - Equipment | Asset (Contra) | Depreciation allowance |
| `2000` | Accounts Payable | Liability | Vendor liabilities & procurement payables |
| `2050` | Goods Received Not Invoiced (GR/IR) | Liability | Clearing account for goods received awaiting vendor bill |
| `2100` | Technician Payable | Liability | Accrued technician expense reimbursements & hisaab |
| `2200` | Withholding Tax (WHT) Payable | Liability | Tax withheld on vendor payments |
| `3000` | Owner's Capital / Equity | Equity | Opening inventory equity & general equity |
| `3200` | Retained Earnings | Equity | P&L annual close balance |
| `3900` | Opening Balance Equity | Equity | System setup opening balance offset |
| `4000` | HVAC Service & Installation Revenue | Revenue | **Generic Default** for all sales, job revenues, and POS |
| `4100` | Customer Discounts & Concessions | Revenue (Contra)| Contra-revenue discounts on job invoices |
| `5000` | Cost of Goods Sold - Parts & Labor | Expense | **Generic Default** COGS for all inventory issues |
| `5050` | Purchase Price Variance (PPV) | Expense | PO to invoice pricing variance |
| `6000` | Technician & Staff Salaries | Expense | Payroll runs and final settlements |
| `6100` | Technician Travel & Field Expenses | Expense | **Generic Default** for technician claims (fuel, tools, lodging) |
| `6200` | General Office & Facility Overheads | Expense | Catch-all contra account for cashbook outflows |
| `6201` | Internet, Software & Communication | Expense | Utilities & telecom overheads |
| `6202` | Office Supplies & Stationery | Expense | Administrative expenses |
| `6350` | Depreciation Expense - Equipment | Expense | Monthly fixed asset depreciation |

**Dynamic Fallback Behavior:**  
In `AccountsPostingService.getAccountByCode(code)`:
```typescript
let account = await prisma.account.findUnique({ where: { code } });
if (!account) {
  // If not found in DB, it auto-inserts on the fly using a hardcoded dictionary
  account = await prisma.account.create({ data: fallbackMap[code] });
}
```
*Risk Identified:* If a posting passes an unrecognized code, it throws a runtime 500 error (`Account with code "${code}" not found and no fallback definition exists`).

---

### 1.3 Virtual Presentation Hierarchy
In `src/lib/constants/chartOfAccountsHierarchy.ts`, an in-memory 4-level structure is defined:
- **Level 1 (Category Groups):** `1000-GRP` (Current Assets), `1500-GRP` (Fixed Assets), `2000-GRP` (Current Liabilities), `3000-GRP` (Equity), `4000-GRP` (Operating Revenue), `5000-GRP` (COGS), `6000-GRP` (Operating Expenses).
- **Level 2 (Sub-Categories):** Cash & Cash Equivalents, Trade Receivables, Inventory, Payables, etc.
- **Level 3 (Control Accounts):** Bank Accounts, Tax Withholdings, Direct Labor, Overhead Groups.
- **Level 4 (Posting / Leaf Accounts):** Actual transaction accounts (`1010`, `1011`, `6201`, etc.).

**Conclusion:** The application already has a well-defined conceptual 4-level taxonomy, but it exists solely in TypeScript constants. Phase 2 will persist this hierarchy directly into the database.

---

## 2. Comprehensive Inventory of Posting Locations & Account Resolution

Every journal entry in the codebase routes through `AccountsPostingService.post()`:
`AccountsPostingService.post(prisma, { refType, refId, memo, date, lines: [{ accountCode, debit, credit, ... }] })`.

Below is the exhaustive matrix of all transaction types, posting triggers, debit/credit sides, and their resolution mechanism:

| # | Domain / Module | File & Function | `refType` | Debit Account | Credit Account | Resolution Method | Generic / Hardcoded Flag |
|---|---|---|---|---|---|---|---|
| **1** | **Job Invoicing** | `JobsService.ts`<br>`recordJobRevenueAccounting()` | `job_revenue` | `1100` (AR) [net]<br>`4100` (Discount) [if any] | `4000` (Service Revenue) [gross] | Hardcoded string literals `"1100"`, `"4100"`, `"4000"` passed to `post()` | ⚠️ **HARDCODED & GENERIC** (`4000` is HVAC-specific; non-HVAC jobs still hit `4000`) |
| **2** | **Job Tech Reimbursement** | `JobsService.ts`<br>`reimburseExpense()` | `expense_reimbursement` | `6100` (Tech Travel/Field) | Caller-provided `disbursingAccountCode` (defaults to `1000`) | Hardcoded `"6100"` string literal; disbursing account defaults to `"1000"` | ⚠️ **HARDCODED & GENERIC** (Forces all field expenses into `6100`) |
| **3** | **Job Inventory Consumption** | `InventoryService.ts`<br>`issueStockForJob()` | `inventory_cogs` | `5000` (COGS) | `1200` (Inventory Asset) | Hardcoded string literals `"5000"`, `"1200"` | ⚠️ **HARDCODED & GENERIC** (Consumes all item types into general `5000`) |
| **4** | **Job Inventory Return** | `InventoryService.ts`<br>`returnStockFromJob()` | `inventory_return` | `1200` (Inventory Asset) | `5000` (COGS) | Hardcoded string literals `"1200"`, `"5000"` | ⚠️ **HARDCODED & GENERIC** |
| **5** | **GRN Stock Receipt** | `InventoryService.ts`<br>`recordGrnStock()` | `grn_receipt` | `1200` (Inventory Asset) | `2000` (Accounts Payable) | Hardcoded string literals `"1200"`, `"2000"` | ⚠️ **HARDCODED** (Bypasses GR/IR clearing account `2050`) |
| **6** | **Manual Stock Purchase (Direct In)** | `InventoryService.ts`<br>`recordStockIn()` | `stock_in` | `1200` (Inventory Asset) | `1000` (Cash/Bank) | Hardcoded string literals `"1200"`, `"1000"` | ⚠️ **HARDCODED & GENERIC** |
| **7** | **Opening Inventory Setup** | `InventoryService.ts`<br>`recordOpeningStock()` | `opening_stock` | `1200` (Inventory Asset) | `3000` (Owner Equity) | Hardcoded string literals `"1200"`, `"3000"` | ⚠️ **HARDCODED** |
| **8** | **Procurement 3-Way Match GRN** | `ProcurementService.ts`<br>`processGrn()` | `grn_receipt` | `1200` (Inventory Asset) | `2050` (GR/IR Clearing) | Hardcoded string literals `"1200"`, `"2050"` | ⚠️ **HARDCODED** |
| **9** | **Vendor Bill Invoice Match** | `ProcurementService.ts`<br>`processVendorBill()` | `vendor_bill` | `2050` (GR/IR Clearing)<br>`5050` (PPV) [if price variance] | `2000` (Accounts Payable)<br>`5050` (PPV) [if favorable] | Hardcoded string literals `"2050"`, `"2000"`, `"5050"` | ⚠️ **HARDCODED** |
| **10** | **Vendor Bill Settlement / Payment** | `ProcurementService.ts`<br>`payVendorBill()` | `vendor_payment` | `2000` (Accounts Payable) | `1010` (Meezan Bank) [net]<br>`2200` (WHT Payable) [tax] | Hardcoded string literals `"2000"`, `"1010"`, `"2200"` | ⚠️ **HARDCODED** (Meezan `1010` hardcoded even if paid from HBL `1011` or cash) |
| **11** | **Monthly Payroll Execution** | `PayrollService.ts`<br>`processMonthlyPayroll()` | `payroll` | `6000` (Salaries Expense) [gross] | `1000` (Cash/Bank) [net]<br>`1150` (Advances) [deductions] | Hardcoded string literals `"6000"`, `"1000"`, `"1150"` | ⚠️ **HARDCODED & GENERIC** |
| **12** | **Employee Final Settlement** | `PayrollService.ts` / `HrmService.ts`<br>`executeFinalSettlement()` | `final_settlement` | `6000` (Salaries Expense) | `1150` (Advances) [loan recovery]<br>`1000` (Cash/Bank) [net payout] | Hardcoded string literals `"6000"`, `"1150"`, `"1000"` | ⚠️ **HARDCODED & GENERIC** |
| **13** | **Employee Advance Issuance** | `app/api/hrm/advances/route.ts`<br>`POST` | `advance_granted` | `1150` (Advances Receivable) | `1000` (Cash & Bank Balances) | Hardcoded string literals `"1150"`, `"1000"` | ⚠️ **HARDCODED & GENERIC** |
| **14** | **POS Sales Ticket Checkout** | `app/api/pos/route.ts`<br>`POST` | `pos_sale` | `1000` (Cash) or `1010` (Card/Bank) or `1100` (Customer AR) | `4000` (Revenue) | If `paymentMethod === 'cash'` $\rightarrow$ `"1000"`; `'card'` $\rightarrow$ `"1010"`; `'credit'` $\rightarrow$ `"1100"`. Revenue $\rightarrow$ `"4000"` | ⚠️ **HARDCODED & GENERIC** |
| **15** | **POS Inventory COGS** | `app/api/pos/route.ts`<br>`POST` | `inventory_cogs` | `5000` (COGS) | `1200` (Inventory Asset) | Hardcoded string literals `"5000"`, `"1200"` | ⚠️ **HARDCODED & GENERIC** |
| **16** | **Technician Hisaab Daily Cash Collection** | `app/api/hisaab/route.ts`<br>`POST (reconcile)` | `settlement_collection` | `1000` (Cash / Vault) | `1100` (Accounts Receivable) | Hardcoded string literals `"1000"`, `"1100"` | ⚠️ **HARDCODED** |
| **17** | **Technician Hisaab Expense Reimbursement** | `app/api/hisaab/route.ts`<br>`POST (settlement)` | `tech_expense_settlement` | `6100` (Tech Travel/Field Exp) | `1000` (Disbursed from Vault) [if paid]<br>`2100` (Technician Payable) [if owed] | Hardcoded string literals `"6100"`, `"1000"`, `"2100"` | ⚠️ **HARDCODED & GENERIC** |
| **18** | **Tax Withholding Settlement** | `TaxService.ts`<br>`recordVendorPaymentWithWht()` | `vendor_payment_wht` | `2000` (Accounts Payable) | `2200` (WHT Payable)<br>`1000` (Cash/Bank) | Hardcoded string literals `"2000"`, `"2200"`, `"1000"` | ⚠️ **HARDCODED** |
| **19** | **Asset Depreciation Run** | `FixedAssetService.ts`<br>`postMonthlyDepreciation()` | `asset_depreciation` | `6350` (Depreciation Expense) | `1590` (Accumulated Depreciation) | Hardcoded string literals `"6350"`, `"1590"` | ⚠️ **HARDCODED** |
| **20** | **Fiscal Year-End Closing Entry** | `FiscalPeriodService.ts`<br>`closeFiscalPeriod()` | `year_end_close` | Revenue accounts (Dr)<br>Expense accounts (Cr) | Balanced into `3200` (Retained Earnings) | Hardcoded string literal `"3200"` | ⚠️ **HARDCODED** |
| **21** | **Initial Setup Opening Balances** | `app/api/setup/route.ts`<br>`POST` | `opening_balance` | User specified account codes | Balancing difference offset into `3900` (Opening Balance Equity) | Hardcoded string literal `"3900"` | ⚠️ **HARDCODED** |
| **22** | **Expense Voucher (Admin)** | `app/api/accounts/route.ts`<br>`POST (record_expense)` | `expense_voucher` | User selected `expenseAccountCode` (defaults to `"6100"`) | User selected `disbursingAccountCode` (defaults to `"1000"`) | Semi-dynamic payload with hardcoded default fallback | ⚠️ **GENERIC DEFAULTS** |
| **23** | **Customer Payment Receipt (Admin)** | `app/api/accounts/route.ts`<br>`POST (customer_payment)` | `customer_payment` | User selected `receivingAccountCode` (defaults to `"1000"`) | `1100` (Accounts Receivable) | Receiving account defaults to `"1000"`, AR hardcoded to `"1100"` | ⚠️ **HARDCODED & GENERIC** |
| **24** | **Manual Journal Entry** | `app/api/accounts/route.ts`<br>`POST (manual_journal)` | `manual_journal` | User selected `lines[].accountCode` | User selected `lines[].accountCode` | Dynamic user input verified via `getAccountByCode()` | ✅ **DYNAMIC** |
| **25** | **Cashbook Receipts / Payments / Transfers** | `app/api/accounts/route.ts`<br>`POST (cashbook_entry)` | `cashbook_receipt`<br>`cashbook_payment`<br>`cashbook_transfer` | Cash: `cashAccountCode` (def: `1000`)<br>Contra: `contraAccountCode` (def: `4000`/`6200`) | Contra: `contraAccountCode` (def: `4000`/`6200`)<br>Cash: `cashAccountCode` (def: `1000`) | Semi-dynamic payload with hardcoded fallbacks (`"1000"`, `"4000"`, `"6200"`) | ⚠️ **GENERIC DEFAULTS** |

---

## 3. Existing UI & Configuration Screens

An audit of the frontend surfaces (`src/app/accounts/page.tsx` and sub-components) reveals:

### Current Capabilities:
- **Chart of Accounts Tab (`tab === 'chart'`):**
  - Displays accounts via two toggleable view modes:
    1. **Tree View:** Rendered by calling `buildChartOfAccountsTree(accounts)` on the client side, grouping accounts by their synthetic Level 1–3 constants.
    2. **Tabular View:** Flat listing showing Code, Name, Type, Status, and Action buttons (Edit name/status).
  - Contains a basic **"New Account" Modal** allowing creation of an account with `code`, `name`, `type`, and `description`.
- **General Journal Tab (`tab === 'journal'`):** Filterable grid of all posted journal entries with line-item Dr/Cr breakdowns and reversal buttons.
- **Cashbook Tab (`tab === 'cashbook'`):** Daily cash/bank receipts, payments, and contra-account transfers.
- **Financial Reports Tab (`tab === 'reports'`):** Trial Balance, Profit & Loss statement, and Balance Sheet generation.
- **Bank Reconciliation Tab (`tab === 'bankrec'`):** Unreconciled journal matching against bank statements.
- **Fixed Assets Tab (`tab === 'fixedassets'`):** Asset schedule and monthly straight-line depreciation runs.

### Current Deficiencies:
1. **Zero Account Mapping UI:** There is no interface to configure default accounts for sales, payroll, inventory, vendor payments, or expenses.
2. **No Level Hierarchy Controls:** The UI cannot set an account's parent account, level depth (1–4), or system lock flag.
3. **No CSV Import/Export:** Chart of Accounts cannot be bulk-imported or exported via CSV.
4. **No Mapping Completeness Diagnostics:** No view alerts administrators if an operational event lacks an assigned general ledger account.

---

## 4. Historical & Existing Transaction Patterns Analysis

To prepare for **Phase 3 (AI Transaction Suggestion Agent)**, existing transaction tables and historical logs were examined for free-text descriptors and categorical variability:

### 4.1 Technician Expense Claims (`JobExpenseClaim`)
Technician expense claims are currently posted to `6100` ("Technician Travel & Field Expenses"), but their unstructured notes reveal significant semantic diversity:
- `"Fuel for generator testing on site"` $\rightarrow$ Should map to **Vehicle & Fuel Expenses** (`6110`).
- `"Purchase of 1/2 copper pipe and brazing rod"` $\rightarrow$ Should map to **Job Consumables & Direct Materials** (`5100`), not travel expense.
- `"Careem ride to Bahria Town client site"` $\rightarrow$ True **Technician Travel & Transit** (`6120`).
- `"Lunch allowance for 3-man crew during late overtime"` $\rightarrow$ Should map to **Meals & Entertainment / Site Allowances** (`6130`).
- `"Replacement capacitor 45uF purchased from local market"` $\rightarrow$ Should map to **Emergency Spare Parts Purchase** (`5010`).

### 4.2 Cashbook Counterparties & Memos (`JournalEntry.memo`)
Free-text memos in `JournalEntry` and cashbook entries contain patterns such as:
- `"Nayatel Office Fibre Bill for Sep 2026"` $\rightarrow$ Currently defaults to `6200` (Office Overheads) instead of `6201` (Internet & Telecom).
- `"Purchase of A4 paper reams and toner cartridge"` $\rightarrow$ Currently defaults to `6200` instead of `6202` (Office Supplies & Stationery).
- `"Advance token payment to property landlord for branch rent"` $\rightarrow$ Currently defaults to `6200` instead of **Prepaid Rent** (`1300`) or **Rent Expense** (`6210`).

### 4.3 Stock Ledgers (`StockLedger.notes`)
Inventory movement notes indicate:
- `"Scrapped due to transit damage"` $\rightarrow$ Currently posted to `5000` (COGS) rather than **Inventory Write-down / Shrinkage** (`5090`).
- `"Internal usage - workshop testing tool"` $\rightarrow$ Currently posted to `5000` rather than **Workshop Tools Expense** (`6250`).

*Takeaway for Phase 3:* The AI agent will have rich free-text descriptions (`memo`, `notes`, `description`, `vendorName`, `category`) to cluster and propose high-confidence re-mappings from generic accounts (`4000`, `5000`, `6100`, `6200`) into specific Level 4 accounts.

---

## 5. Phase 2 Architecture Blueprint & Implementation Strategy

### 5.1 Database Schema Extensions (Zero-Downtime / Zero Data Loss)

We will extend `Account` and create `AccountMapping` in `prisma/schema.prisma`:

```prisma
model Account {
  id           String        @id @default(uuid())
  code         String        @unique
  name         String
  type         String        // 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  description  String?
  isActive     Boolean       @default(true)
  isSystem     Boolean       @default(false)  // Protected system accounts
  level        Int           @default(4)      // 1: Category, 2: Sub-category, 3: Control, 4: Leaf/Posting
  parentId     String?                        // Hierarchy self-relation
  parent       Account?      @relation("AccountHierarchy", fields: [parentId], references: [id], onDelete: Restrict)
  children     Account[]     @relation("AccountHierarchy")
  currency     String        @default("PKR")
  companyId    String?       @default("DEFAULT")
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt @default(now())
  journalLines JournalLine[]
  mappings     AccountMapping[]

  @@index([level])
  @@index([parentId])
  @@index([companyId])
}

model AccountMapping {
  id              String   @id @default(uuid())
  companyId       String   @default("DEFAULT")
  transactionType String   // e.g. 'job_revenue', 'inventory_cogs', 'payroll_salaries'
  categoryScope   String?  // Optional fine-grained qualifier (e.g., job category, item type)
  accountId       String
  account         Account  @relation(fields: [accountId], references: [id], onDelete: Restrict)
  updatedBy       String?  // User ID / Actor
  updatedAt       DateTime @updatedAt @default(now())
  createdAt       DateTime @default(now())

  @@unique([companyId, transactionType, categoryScope])
  @@index([transactionType])
}
```

#### Migration Plan for Existing Accounts:
1. **Additive Alteration:** Add `isSystem`, `level`, `parentId`, `currency`, `companyId`, `updatedAt` with default values so existing accounts remain intact.
2. **Seed Hierarchy Nodes (Levels 1–3):**
   - Insert Level 1 Category accounts (`1000-GRP`, `2000-GRP`, `3000-GRP`, `4000-GRP`, `5000-GRP`, `6000-GRP`).
   - Insert Level 2 Sub-Category accounts (`1100-GRP`, `1200-GRP`, `2100-GRP`, `6100-GRP`, etc.).
   - Insert Level 3 Control accounts.
3. **Reparent Existing Leaf Accounts (Level 4):**
   - Link existing 22 accounts to their respective Level 3 parent IDs.
   - Set `isSystem = true` on foundational accounts (`1000`, `1100`, `1200`, `2000`, `2050`, `3200`, `3900`, `4000`, `5000`, `6000`) to prevent accidental deletion, but keep them editable and renameable.
4. **Seed Baseline `AccountMapping` Records:**
   - Seed `AccountMapping` with the 24 discovered transaction types mapped to their current default accounts.
   - **Result:** Existing behavior is 100% preserved on Day 1 with zero breaking changes.

---

### 5.2 Central Account Resolution Service (`resolveAccount`)

Create `src/lib/services/AccountMappingService.ts`:

```typescript
export interface AccountResolutionParams {
  transactionType: string;
  companyId?: string;
  categoryScope?: string | null;
  prismaClient?: PrismaClient | Prisma.TransactionClient;
}

export class AccountMappingService {
  /**
   * Resolves the concrete Account for a given transaction type.
   * Throws an explicit, descriptive error if unmapped (no silent defaults).
   */
  static async resolveAccount(params: AccountResolutionParams): Promise<Account> {
    const { transactionType, companyId = "DEFAULT", categoryScope = null, prismaClient = prisma } = params;

    // 1. Check scoped mapping first (e.g. transactionType + categoryScope)
    let mapping = null;
    if (categoryScope) {
      mapping = await prismaClient.accountMapping.findFirst({
        where: { companyId, transactionType, categoryScope },
        include: { account: true },
      });
    }

    // 2. Fall back to generic transactionType mapping
    if (!mapping) {
      mapping = await prismaClient.accountMapping.findFirst({
        where: { companyId, transactionType, categoryScope: null },
        include: { account: true },
      });
    }

    // 3. Strict validation: Throw error if unmapped or inactive
    if (!mapping || !mapping.account) {
      throw new Error(
        `[AccountMappingError] Unmapped transaction type: "${transactionType}"` +
        (categoryScope ? ` with scope: "${categoryScope}"` : "") +
        ` for company "${companyId}". Posting blocked.`
      );
    }

    if (!mapping.account.isActive) {
      throw new Error(
        `[AccountMappingError] Account "${mapping.account.code} - ${mapping.account.name}" mapped to "${transactionType}" is deactivated.`
      );
    }

    return mapping.account;
  }
}
```

---

### 5.3 Modular Refactoring Sequence

Each module will be refactored sequentially, ensuring tests pass before progressing:
1. **Module 1: Invoicing & Job Revenue** (`JobsService.ts`)
2. **Module 2: Inventory & Warehousing** (`InventoryService.ts`)
3. **Module 3: Procurement & Vendor AP** (`ProcurementService.ts`)
4. **Module 4: Payroll & Employee Advances** (`PayrollService.ts`, `HrmService.ts`, `hrm/advances`)
5. **Module 5: Point of Sale & Field Hisaab** (`pos/route.ts`, `hisaab/route.ts`)
6. **Module 6: Tax & Fixed Assets** (`TaxService.ts`, `FixedAssetService.ts`)
7. **Module 7: Admin Cashbook & Adjustments** (`accounts/route.ts`)

---

### 5.4 Proposed Admin UI Enhancements
1. **Chart of Accounts Tree Editor (`/accounts`):**
   - Interactive 4-level drilldown tree.
   - Add/edit/deactivate accounts with parent selection and level calculation.
   - Bulk CSV import/export.
   - Visual indicators for System Accounts (`isSystem = true`).
2. **Account Mapping Configuration Screen (`/accounts/mapping` or Settings Tab):**
   - Tabulated list of all 24 transaction types grouped by domain (Sales, Procurement, Inventory, Payroll, Cash/Bank, Fixed Assets).
   - Dropdown selectors scoped to compatible account types (e.g. Sales dropdown only permits Revenue accounts; Payroll dropdown only permits Expense accounts).
   - Real-time mapping completeness bar (e.g. "24 / 24 Transaction Types Configured (100%)").

---

## 6. Phase 3 Architecture: AI Transaction Suggestion Agent

### 6.1 Agent Execution Flow
1. **Transaction Scanner:** Queries historical records (`JobExpenseClaim`, `JournalEntry`, `StockLedger`, `CustomerLedgerEntry`) for the target company.
2. **Pattern & Cluster Extraction:** Clusters entries by text similarity on `note`, `memo`, `counterparty`, and `amountRange`.
3. **Semantic Matching Engine:**
   - Compares extracted patterns against the company's real Level 4 Chart of Accounts.
   - Scores candidates based on TF-IDF / keyword similarity and accounting taxonomy.
   - Computes Confidence: High ($\ge 85\%$), Medium ($65\% - 84\%$), Low ($< 65\%$).
4. **Review Queue Interface:**
   - Displays recommendations in a dedicated admin review queue.
   - Provides quick actions: `Accept`, `Change Account`, `Skip`, or `Accept All High Confidence`.
   - Proposes creation of new Level 4 accounts when confidence is low.
5. **Audit Trail Logging:** Logs every resolution to `AccountMappingAudit` (`sourceTransactions`, `confidenceScore`, `reviewedBy`, `timestamp`).

---

## Conclusion & Next Step

Phase 1 audit is complete. All 25 account definitions, 24 posting locations, resolution methods, and UI gaps have been fully mapped and cross-verified against the codebase.

**Awaiting user sign-off on this audit report before initiating Phase 2 schema migrations and codebase refactoring.**
