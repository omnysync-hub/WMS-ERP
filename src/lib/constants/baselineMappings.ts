/**
 * Default account for every transaction type ("Workman Services ERP – Accounts Linking", corrected COA).
 * Used by Setup > "Seed baseline mappings" and by scripts/recode-coa-5digit.ts.
 * Users can change any of these in Accounts > Account Mapping.
 */
export const BASELINE_MAPPINGS: Array<{ transactionType: string; accountCode: string }> = [
  // Sales & invoicing
  { transactionType: "job_revenue_receivable", accountCode: "11201" },
  { transactionType: "job_revenue_sales", accountCode: "41101" },
  { transactionType: "job_revenue_repair", accountCode: "41102" },
  { transactionType: "job_revenue_goods", accountCode: "41103" },
  { transactionType: "job_revenue_discount", accountCode: "41202" },
  { transactionType: "other_income", accountCode: "42101" },
  // Customer receipts: the receipt screen picks the mode (cash / bank / wallet)
  { transactionType: "customer_payment_receiving", accountCode: "11101" },
  { transactionType: "customer_payment_bank", accountCode: "11103" },
  { transactionType: "customer_payment_wallet", accountCode: "11104" },
  { transactionType: "customer_payment_receivable", accountCode: "11201" },
  { transactionType: "customer_advance_liability", accountCode: "21105" },
  { transactionType: "ar_control", accountCode: "11201" },
  // Sales returns / credit notes
  { transactionType: "sales_return_contra", accountCode: "41201" },
  // Daily Hisaab: field collection -> Cash with Technician, surrender -> vault
  { transactionType: "settlement_collection_vault", accountCode: "11105" },
  { transactionType: "settlement_cash_surrender", accountCode: "11101" },
  { transactionType: "settlement_collection_receivable", accountCode: "11201" },
  { transactionType: "wht_receivable", accountCode: "11203" },
  // Output taxes: goods (FBR) and services (PRA / SRB) are filed separately
  { transactionType: "sales_tax_payable", accountCode: "21201" },
  { transactionType: "services_tax_payable", accountCode: "21202" },
  // POS
  { transactionType: "pos_sale_cash", accountCode: "11101" },
  { transactionType: "pos_sale_bank", accountCode: "11103" },
  { transactionType: "pos_sale_receivable", accountCode: "11201" },
  { transactionType: "pos_sale_revenue", accountCode: "41104" },
  { transactionType: "pos_cogs_expense", accountCode: "51103" },
  { transactionType: "inventory_adjustment_expense", accountCode: "51104" },
  { transactionType: "pos_inventory_asset", accountCode: "11302" },
  // Field expenses
  { transactionType: "expense_reimbursement_expense", accountCode: "52105" },
  { transactionType: "expense_reimbursement_disbursing", accountCode: "11102" },
  { transactionType: "tech_expense_settlement_expense", accountCode: "52105" },
  { transactionType: "tech_expense_settlement_vault", accountCode: "11105" },
  { transactionType: "cashbook_contra_revenue", accountCode: "42101" },
  { transactionType: "cashbook_contra_expense", accountCode: "62102" },
  { transactionType: "bank_operating", accountCode: "11103" },
  // Inventory & COGS
  { transactionType: "inventory_cogs_expense", accountCode: "51101" },
  { transactionType: "inventory_cogs_asset", accountCode: "11301" },
  { transactionType: "inventory_return_asset", accountCode: "11301" },
  { transactionType: "inventory_in_transit", accountCode: "11303" },
  { transactionType: "inventory_return_cogs", accountCode: "51101" },
  { transactionType: "stock_in_asset", accountCode: "11301" },
  { transactionType: "stock_in_disbursing", accountCode: "11101" },
  { transactionType: "opening_stock_asset", accountCode: "11301" },
  { transactionType: "opening_stock_equity", accountCode: "31104" },
  // Procurement & AP
  { transactionType: "grn_receipt_asset", accountCode: "11301" },
  { transactionType: "grn_receipt_clearing", accountCode: "21102" },
  { transactionType: "grn_receipt_payable", accountCode: "21101" },
  { transactionType: "vendor_bill_clearing", accountCode: "21102" },
  { transactionType: "vendor_bill_payable", accountCode: "21101" },
  { transactionType: "vendor_bill_ppv", accountCode: "51105" },
  { transactionType: "vendor_bill_discount_received", accountCode: "42102" },
  { transactionType: "vendor_bill_tax_cost", accountCode: "62107" },
  { transactionType: "input_tax_receivable", accountCode: "11204" },
  { transactionType: "vendor_payment_payable", accountCode: "21101" },
  { transactionType: "vendor_payment_disbursing", accountCode: "11103" },
  { transactionType: "vendor_payment_wht", accountCode: "21203" },
  { transactionType: "purchase_return_contra", accountCode: "51106" },
  { transactionType: "ap_control", accountCode: "21101" },
  // Payroll: Step 1 (run) accrues to Salaries Payable, Step 2 (payment) pays it out
  { transactionType: "payroll_salaries_expense", accountCode: "61101" },
  { transactionType: "payroll_technician_wages_expense", accountCode: "52104" },
  { transactionType: "payroll_eobi_employer_expense", accountCode: "61102" },
  { transactionType: "payroll_salaries_payable", accountCode: "21106" },
  { transactionType: "payroll_wht_payable", accountCode: "21204" },
  { transactionType: "payroll_eobi_payable", accountCode: "21205" },
  { transactionType: "payroll_net_disbursing", accountCode: "11103" },
  { transactionType: "payroll_advance_deduction", accountCode: "11202" },
  { transactionType: "advance_granted_receivable", accountCode: "11202" },
  { transactionType: "advance_granted_disbursing", accountCode: "11101" },
  { transactionType: "technician_commission_expense", accountCode: "52103" },
  { transactionType: "technician_commission_payable", accountCode: "21104" },
  { transactionType: "tech_expense_settlement_payable", accountCode: "21103" },
  // Fixed assets & close
  { transactionType: "fixed_asset_cost", accountCode: "15101" },
  { transactionType: "depreciation_expense", accountCode: "64101" },
  { transactionType: "accumulated_depreciation", accountCode: "15190" },
  { transactionType: "retained_earnings_equity", accountCode: "31103" },
  { transactionType: "opening_balance_equity", accountCode: "31104" },
  { transactionType: "owner_drawings", accountCode: "31102" },
];

/**
 * Mapping rules the Accounts Linking review says must point somewhere new. The COA migration
 * re-points these even when a mapping already exists (all other existing mappings are kept).
 */
export const ACCOUNTS_LINKING_REMAPS: Record<string, string> = {
  settlement_collection_vault: "11105",
  tech_expense_settlement_vault: "11105",
  vendor_bill_tax_cost: "62107",
  vendor_bill_ppv: "51105",
  sales_tax_payable: "21201",
  payroll_salaries_expense: "61101",
  payroll_net_disbursing: "11103",
};

/** Default expense categories: each posts to its own account when a claim or voucher is paid. */
export const BASELINE_EXPENSE_CATEGORIES: Array<{ code: string; name: string; accountCode: string }> = [
  { code: "FUEL", name: "Job Fuel & Conveyance", accountCode: "52101" },
  { code: "FOOD", name: "Job Food & Meals", accountCode: "52102" },
  { code: "JOB_OTHER", name: "Other Direct Job Costs", accountCode: "52105" },
  { code: "MARKET_GOODS", name: "Goods Bought from Market for Customer", accountCode: "51102" },
  { code: "TRAVEL", name: "Travel & Field", accountCode: "62101" },
  { code: "OFFICE", name: "Office & Overheads", accountCode: "62102" },
  { code: "SUPPLIES", name: "Office Supplies & Stationery", accountCode: "62103" },
  { code: "MEALS", name: "Meals & Entertainment", accountCode: "62104" },
  { code: "REPAIRS", name: "Repairs & Maintenance", accountCode: "62105" },
  { code: "VEHICLE", name: "Vehicle Running Costs", accountCode: "62106" },
  { code: "ELECTRICITY", name: "Electricity", accountCode: "63101" },
  { code: "WATER", name: "Water", accountCode: "63102" },
  { code: "INTERNET", name: "Internet", accountCode: "63103" },
  { code: "PHONE", name: "Telephone & Mobile", accountCode: "63104" },
  { code: "RENT", name: "Rent", accountCode: "64102" },
  { code: "BANK", name: "Bank Charges", accountCode: "64103" },
  { code: "MARKETING", name: "Marketing & Advertising", accountCode: "64104" },
  { code: "MISC", name: "Miscellaneous Expenses", accountCode: "64109" },
];
