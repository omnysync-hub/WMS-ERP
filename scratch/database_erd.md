```mermaid
erDiagram
  Account {
    String id
    String code
    String name
    String type
    String description
    Boolean isActive
    Boolean isSystem
    Int level
    String parentId
    String currency
    String companyId
    DateTime createdAt
    DateTime updatedAt
  }
  AccountMapping {
    String id
    String companyId
    String transactionType
    String categoryScope
    String accountId
    String updatedBy
    DateTime updatedAt
    DateTime createdAt
  }
  AccountMappingAudit {
    String id
    String transactionType
    String sourceTransactionIds
    String suggestedAccountId
    String proposedAccountCode
    String proposedAccountName
    String proposedAccountType
    String proposedParentCode
    Float confidenceScore
    String status
    String reviewedBy
    DateTime reviewedAt
    DateTime createdAt
  }
  JournalEntry {
    String id
    DateTime date
    String memo
    String refType
    String refId
    String postedBy
    DateTime postedAt
    String status
    String reversalOfId
    String reversedById
    Boolean requiresApproval
    String approvedBy
    DateTime approvedAt
    String fiscalPeriodId
    DateTime createdAt
  }
  JournalLine {
    String id
    String journalEntryId
    String accountId
    Float debit
    Float credit
  }
  Invoice {
    String id
    String invoiceNumber
    String jobId
    String customerId
    String customerName
    Float amount
    String status
    DateTime createdAt
  }
  Quotation {
    String id
    String quotationNumber
    String customerId
    Float totalAmount
    String status
    String remarks
    DateTime createdAt
  }
  Customer {
    String id
    String name
    String phone
    String email
    String addressText
    Float lat
    Float lng
    DateTime createdAt
  }
  CareOfParty {
    String id
    String companyName
    String personName
    String phone
    DateTime createdAt
  }
  Job {
    String id
    String jobNumber
    String customerId
    String careOfPartyId
    String manualJobNumber
    String jobType
    String remarks
    String status
    String assignedTechnicianId
    Float discountAmount
    String discountReason
    String qualityFlag
    String verifiedChecklist
    DateTime createdAt
    DateTime finalizedAt
    DateTime verifiedAt
  }
  JobItem {
    String id
    String jobId
    String description
    Float quantityPlanned
    Float quantityActual
    Float unitRate
  }
  JobStatusHistory {
    String id
    String jobId
    String fromStatus
    String toStatus
    String changedBy
    DateTime changedAt
    String metaJson
  }
  InventoryRequest {
    String id
    String jobId
    String technicianId
    String item
    Float qtyRequested
    String status
    DateTime createdAt
  }
  StockReturn {
    String id
    String jobId
    String technicianId
    String item
    Float qtyReturned
    String acknowledgedBy
    DateTime acknowledgedAt
    DateTime createdAt
  }
  JobExpenseClaim {
    String id
    String jobId
    String technicianId
    Float amount
    String note
    String receiptUrl
    String status
    DateTime paidAt
    DateTime createdAt
  }
  HisaabSettlement {
    String id
    String jobId
    String technicianId
    Float amountExpected
    Float amountCollected
    Boolean isFull
    Float balanceDue
    DateTime nextVisitDate
    Float discountAmount
    String settledBy
    DateTime settledAt
  }
  TechnicianLedgerEntry {
    String id
    String technicianId
    String type
    Float amount
    String refJobId
    String notes
    DateTime createdAt
  }
  Product {
    String id
    String sku
    String name
    String unit
    Float unitPrice
    Float costPrice
    Float stockQuantity
    Float reorderLevel
    DateTime createdAt
  }
  StockLedger {
    String id
    String productId
    Float qty
    String direction
    String refType
    String refId
    String notes
    DateTime createdAt
  }
  PurchaseRequisition {
    String id
    String prNumber
    String requestedBy
    String department
    String site
    DateTime dateRequired
    String costCenter
    String projectCode
    String budgetCode
    String priority
    String status
    String notes
    String attachments
    String approvedBy
    DateTime approvedAt
    String rejectedBy
    DateTime rejectedAt
    String rejectionReason
    DateTime createdAt
    DateTime updatedAt
  }
  PurchaseRequisitionItem {
    String id
    String prId
    String productId
    String itemCode
    String description
    Float quantity
    String unit
    Float estimatedPrice
    Float convertedQuantity
  }
  RequestForQuotation {
    String id
    String rfqNumber
    String title
    DateTime dueDate
    String status
    String notes
    String winnerVendorId
    DateTime awardedAt
    DateTime createdAt
    DateTime updatedAt
  }
  RfqItem {
    String id
    String rfqId
    String productId
    String itemCode
    String description
    Float quantity
    String unit
    Float targetPrice
  }
  RfqVendor {
    String id
    String rfqId
    String vendorId
    String status
    Int deliveryDays
    String paymentTerms
    Float qualityScore
    Float commercialScore
    Float totalQuoted
    Boolean isWinner
    String remarks
    String quotationReference
    DateTime submittedAt
  }
  VendorQuotationItem {
    String id
    String rfqVendorId
    String rfqItemId
    Float unitPrice
    Float taxRate
    Float lineTotal
    String notes
  }
  RfqRequisitionLink {
    String id
    String rfqId
    String prId
  }
  PurchaseOrder {
    String id
    String poNumber
    String poType
    String prId
    String rfqId
    String vendorId
    String supplierName
    String supplierEmail
    DateTime poDate
    DateTime expectedDeliveryDate
    String paymentTerms
    String currency
    String shippingAddress
    String termsAndConditions
    String status
    String approvedBy
    DateTime approvedAt
    DateTime sentAt
    Float totalAmount
    Float whtAmount
    Float netPayable
    DateTime createdAt
    DateTime updatedAt
  }
  PurchaseOrderItem {
    String id
    String poId
    String productId
    String itemCode
    String description
    String unit
    Float quantity
    Float unitCost
    Float discountPercent
    Float taxPercent
    Float lineTotal
    String deliverySchedule
    String prItemId
    Float quantityReceived
    Float quantityInvoiced
  }
  GoodsReceipt {
    String id
    String grnNumber
    String poId
    String receivedBy
    DateTime receivedDate
    String warehouseLocation
    String deliveryChallan
    String qualityStatus
    String status
    String notes
    String accountingJournalId
    DateTime createdAt
  }
  GoodsReceiptItem {
    String id
    String grnId
    String poItemId
    String productId
    String itemCode
    String description
    String unit
    Float quantityReceived
    Float quantityAccepted
    Float quantityRejected
    String qualityStatus
    String rejectionReason
    String batchNumber
    String serialNumber
    DateTime expiryDate
  }
  SupplierInvoice {
    String id
    String invoiceNumber
    String referenceNumber
    String vendorId
    String poId
    String grnId
    DateTime invoiceDate
    DateTime dueDate
    Float subtotal
    Float taxAmount
    Float totalAmount
    String matchStatus
    Float priceVariance
    Float quantityVariance
    String matchNotes
    String approvedBy
    DateTime approvedAt
    Float paidAmount
    String paymentStatus
    String journalEntryId
    DateTime createdAt
  }
  SupplierInvoiceItem {
    String id
    String invoiceId
    String poItemId
    String grnItemId
    String productId
    String description
    Float billedQuantity
    Float billedUnitPrice
    Float poUnitPrice
    Float grnQuantity
    Float lineTotal
    Float variance
  }
  SupplierPayment {
    String id
    String paymentNumber
    String supplierInvoiceId
    String vendorId
    DateTime paymentDate
    Float amount
    String paymentMethod
    String reference
    String bankAccountId
    Float whtAmount
    String journalEntryId
    String notes
    DateTime createdAt
  }
  PosSale {
    String id
    String saleNumber
    Float totalAmount
    Float subtotal
    Float discountAmount
    Float taxAmount
    Float amountTendered
    Float changeGiven
    String paymentMethod
    String customerName
    String customerPhone
    String cashierName
    String notes
    String status
    DateTime createdAt
  }
  PosSaleItem {
    String id
    String saleId
    String productId
    Float quantity
    Float unitPrice
  }
  PosRegisterSession {
    String id
    String sessionNumber
    String cashierName
    Float openingFloat
    Float closingCash
    Float expectedCash
    Float discrepancy
    Int totalSalesCount
    Float totalSalesAmount
    Float cashSalesAmount
    Float cardSalesAmount
    Float cashInTotal
    Float cashOutTotal
    String status
    DateTime openedAt
    DateTime closedAt
    String notes
  }
  FiscalPeriod {
    String id
    Int fiscalYear
    Int periodNumber
    String name
    DateTime startDate
    DateTime endDate
    String status
    String closedBy
    DateTime closedAt
    DateTime createdAt
  }
  Vendor {
    String id
    String vendorCode
    String name
    String contactPerson
    String phone
    String email
    String addressText
    String ntnNumber
    String strnNumber
    String taxId
    String paymentTerms
    String currency
    String bankName
    String bankAccountTitle
    String bankAccountNumber
    String category
    String status
    Float whtRate
    Boolean whtExempt
    Int paymentTermsDays
    DateTime createdAt
  }
  CustomerLedgerEntry {
    String id
    String customerId
    DateTime postingDate
    String entryType
    String documentNumber
    String journalEntryId
    Float debit
    Float credit
    Float runningBalance
    DateTime dueDate
    Float clearedAmount
    Boolean isFullyCleared
    String notes
    DateTime createdAt
  }
  VendorLedgerEntry {
    String id
    String vendorId
    DateTime postingDate
    String entryType
    String documentNumber
    String journalEntryId
    Float debit
    Float credit
    Float runningBalance
    DateTime dueDate
    Float whtWithheld
    String cprNumber
    Float clearedAmount
    Boolean isFullyCleared
    String notes
    DateTime createdAt
  }
  BankStatementLine {
    String id
    String bankAccountId
    DateTime statementDate
    DateTime valueDate
    String description
    String referenceNumber
    Float debit
    Float credit
    Float runningBalance
    String status
    String matchedJournalLineId
    DateTime reconciledAt
    String reconciledBy
    String batchImportId
    DateTime createdAt
  }
  FixedAsset {
    String id
    String assetNumber
    String name
    String category
    String hrmAssetId
    DateTime acquisitionDate
    Float acquisitionCost
    Float salvageValue
    Int usefulLifeMonths
    String depreciationMethod
    String assetAccountCode
    String accumDeprAccountCode
    String deprExpenseAccountCode
    Float accumulatedDepreciation
    Float bookValue
    String lastDepreciationPeriod
    String status
    DateTime createdAt
  }
  CompanySettings {
    String id
    String legalName
    String tradeName
    String addressText
    String phone
    String email
    String ntnNumber
    String strnNumber
    String baseCurrency
    Int fiscalYearStartMonth
    Float approvalThreshold
    Boolean isSetupCompleted
    DateTime goLiveDate
    DateTime createdAt
    DateTime updatedAt
  }
  FinancialAuditLog {
    String id
    String entity
    String entityId
    String action
    String beforeValue
    String afterValue
    String userId
    String userName
    String userRole
    String ipAddress
    DateTime timestamp
  }
  Employee {
    String id
    String name
    String phone
    String email
    String role
    String department
    String designation
    String employmentType
    DateTime joinDate
    Float salary
    String status
    DateTime probationEndDate
    String probationStatus
    String reportingManagerId
    Boolean faceEnrolled
    String faceTemplateUrl
    Float faceEmbedding
    DateTime faceEnrolledAt
    Int faceEnrollmentCount
    Boolean active
    Float lat
    Float lng
    DateTime lastPingAt
    DateTime createdAt
  }
  GeofenceZone {
    String id
    String name
    Float lat
    Float lng
    Float radiusMeters
    Boolean isActive
    DateTime createdAt
  }
  AttendanceLog {
    String id
    String employeeId
    DateTime timestamp
    Float faceMatchScore
    Float livenessScore
    Float lat
    Float lng
    String geofenceZoneId
    String deviceId
    Boolean withinGeofence
    Boolean flaggedForReview
    String flagReason
    DateTime flagResolvedAt
    String flagResolvedBy
    String flagResolutionNotes
    String result
    String notes
  }
  EmployeeAdvance {
    String id
    String employeeId
    Float amount
    String status
    String approvedBy
    DateTime createdAt
  }
  PayrollRun {
    String id
    String period
    String status
    String approvedBy
    DateTime approvedAt
    Float totalGross
    Float totalDeductions
    Float totalNet
    DateTime createdAt
  }
  Payslip {
    String id
    String payrollRunId
    String employeeId
    Float grossSalary
    Float advanceDeduction
    Float expenseAdjustment
    Float netSalary
    String status
    DateTime createdAt
  }
  Project {
    String id
    String projectNumber
    String name
    String customerId
    String status
    Float totalBudget
    DateTime startDate
    DateTime endDate
    DateTime createdAt
  }
  BOQItem {
    String id
    String projectId
    String itemCode
    String description
    String unit
    Float plannedQty
    Float unitRate
    DateTime createdAt
  }
  ProjectTask {
    String id
    String projectId
    String boqItemId
    String title
    String description
    String status
    String assignedTechnicianId
    DateTime createdAt
  }
  FeedbackCall {
    String id
    String jobId
    String calledBy
    DateTime calledAt
    String outcome
    String remarks
    DateTime followUpDate
    DateTime createdAt
  }
  JobRequisition {
    String id
    String requisitionNumber
    String role
    String department
    Int headcount
    String reason
    String status
    String approvedBy
    DateTime createdAt
  }
  Candidate {
    String id
    String requisitionId
    String name
    String email
    String phone
    String stage
    String resumeUrl
    String notes
    DateTime createdAt
  }
  CandidateInterview {
    String id
    String candidateId
    DateTime scheduledAt
    String interviewer
    String notes
    DateTime createdAt
  }
  Offer {
    String id
    String candidateId
    String role
    Float salary
    DateTime startDate
    String status
    DateTime createdAt
  }
  OnboardingChecklist {
    String id
    String employeeId
    String item
    Boolean isDone
    String owner
    DateTime completedAt
    DateTime createdAt
  }
  OffboardingChecklist {
    String id
    String employeeId
    String item
    Boolean isDone
    String owner
    DateTime completedAt
    DateTime createdAt
  }
  ExitInterview {
    String id
    String employeeId
    String reason
    String feedback
    Boolean rehireEligible
    DateTime completedAt
  }
  FinalSettlement {
    String id
    String employeeId
    Float grossAmount
    Float advanceDeduction
    Float expenseAdjustment
    Float leaveEncashment
    Float netAmount
    String status
    String journalEntryId
    DateTime createdAt
  }
  LeaveType {
    String id
    String name
    String accrualRule
    Float maxDays
  }
  LeaveBalance {
    String id
    String employeeId
    String leaveTypeId
    Float accrued
    Float taken
    Float balance
  }
  LeaveRequest {
    String id
    String employeeId
    String leaveTypeId
    DateTime startDate
    DateTime endDate
    Float daysCount
    String reason
    String status
    String approvedBy
    DateTime approvedAt
    DateTime createdAt
  }
  CompanyHoliday {
    String id
    String name
    DateTime date
    String description
  }
  Asset {
    String id
    String tag
    String name
    String category
    String status
    DateTime purchaseDate
    String currentEmployeeId
    DateTime createdAt
  }
  AssetAssignment {
    String id
    String assetId
    String employeeId
    DateTime assignedAt
    DateTime returnedAt
    String conditionNotes
    String assignedBy
  }
  GrievanceTicket {
    String id
    String ticketNumber
    String employeeId
    String category
    String description
    String status
    String assignedTo
    DateTime createdAt
  }
  GrievanceComment {
    String id
    String ticketId
    String authorId
    String authorName
    String comment
    DateTime createdAt
  }
  GrievanceStatusHistory {
    String id
    String ticketId
    String fromStatus
    String toStatus
    String changedBy
    DateTime changedAt
  }
  ActivityLog {
    String id
    DateTime timestamp
    String actorId
    String actorName
    String actorRole
    String category
    String action
    String target
    String metadata
    String ipAddress
    DateTime createdAt
  }
  RollbackLog {
    String id
    DateTime timestamp
    String entityType
    String entityId
    String entityNumber
    String action
    String actorName
    String actorRole
    String stateBefore
    String stateAfter
    String status
    DateTime rolledBackAt
    String rolledBackBy
    Boolean canRollback
    String reason
    DateTime createdAt
  }
  DevicePushToken {
    String id
    String employeeId
    String token
    String platform
    String deviceModel
    String osVersion
    String appVersion
    Boolean isActive
    DateTime lastActiveAt
    DateTime createdAt
    DateTime updatedAt
  }
  MobileAppRequest {
    String id
    String recipientId
    String senderId
    String senderName
    String senderRole
    String type
    String title
    String body
    String priority
    String payloadJson
    Boolean actionRequired
    String actionStatus
    String actionResponseJson
    String deliveryStatus
    DateTime sentAt
    DateTime readAt
    DateTime respondedAt
    DateTime createdAt
  }

  Account }|--|| Account : "parent"
  Account ||--o{ Account : "children"
  Account ||--o{ JournalLine : "journalLines"
  Account ||--o{ AccountMapping : "mappings"
  Account ||--o{ AccountMappingAudit : "auditSuggestions"
  AccountMapping }|--|| Account : "account"
  AccountMappingAudit }|--|| Account : "suggestedAccount"
  JournalEntry ||--o{ JournalLine : "lines"
  JournalLine }|--|| JournalEntry : "journalEntry"
  JournalLine }|--|| Account : "account"
  Customer ||--o{ Job : "jobs"
  Customer ||--o{ Project : "projects"
  Customer ||--o{ CustomerLedgerEntry : "customerLedgerEntries"
  CareOfParty ||--o{ Job : "jobs"
  Job }|--|| Customer : "customer"
  Job }|--|| CareOfParty : "careOfParty"
  Job }|--|| Employee : "assignedTechnician"
  Job ||--o{ JobItem : "items"
  Job ||--o{ JobStatusHistory : "statusHistory"
  Job ||--o{ InventoryRequest : "inventoryRequests"
  Job ||--o{ StockReturn : "stockReturns"
  Job ||--o{ JobExpenseClaim : "expenseClaims"
  Job ||--o{ HisaabSettlement : "hisaabSettlements"
  Job ||--o{ FeedbackCall : "feedbackCalls"
  JobItem }|--|| Job : "job"
  JobStatusHistory }|--|| Job : "job"
  InventoryRequest }|--|| Job : "job"
  StockReturn }|--|| Job : "job"
  JobExpenseClaim }|--|| Job : "job"
  HisaabSettlement }|--|| Job : "job"
  Product ||--o{ StockLedger : "stockEntries"
  Product ||--o{ PurchaseRequisitionItem : "prItems"
  Product ||--o{ PurchaseOrderItem : "poItems"
  Product ||--o{ GoodsReceiptItem : "grnItems"
  Product ||--o{ PosSaleItem : "posItems"
  Product ||--o{ RfqItem : "rfqItems"
  Product ||--o{ SupplierInvoiceItem : "supplierInvoiceItems"
  StockLedger }|--|| Product : "product"
  PurchaseRequisition ||--o{ PurchaseRequisitionItem : "items"
  PurchaseRequisition ||--o{ PurchaseOrder : "purchaseOrders"
  PurchaseRequisition ||--o{ RfqRequisitionLink : "rfqLinks"
  PurchaseRequisitionItem }|--|| PurchaseRequisition : "pr"
  PurchaseRequisitionItem }|--|| Product : "product"
  RequestForQuotation ||--o{ RfqItem : "items"
  RequestForQuotation ||--o{ RfqVendor : "vendors"
  RequestForQuotation ||--o{ RfqRequisitionLink : "prLinks"
  RequestForQuotation ||--o{ PurchaseOrder : "purchaseOrders"
  RfqItem }|--|| RequestForQuotation : "rfq"
  RfqItem }|--|| Product : "product"
  RfqItem ||--o{ VendorQuotationItem : "quotationItems"
  RfqVendor }|--|| RequestForQuotation : "rfq"
  RfqVendor }|--|| Vendor : "vendor"
  RfqVendor ||--o{ VendorQuotationItem : "quotationItems"
  VendorQuotationItem }|--|| RfqVendor : "rfqVendor"
  VendorQuotationItem }|--|| RfqItem : "rfqItem"
  RfqRequisitionLink }|--|| RequestForQuotation : "rfq"
  RfqRequisitionLink }|--|| PurchaseRequisition : "pr"
  PurchaseOrder }|--|| PurchaseRequisition : "pr"
  PurchaseOrder }|--|| RequestForQuotation : "rfq"
  PurchaseOrder }|--|| Vendor : "vendor"
  PurchaseOrder ||--o{ PurchaseOrderItem : "items"
  PurchaseOrder ||--o{ GoodsReceipt : "goodsReceipts"
  PurchaseOrder ||--o{ SupplierInvoice : "supplierInvoices"
  PurchaseOrderItem }|--|| PurchaseOrder : "po"
  PurchaseOrderItem }|--|| Product : "product"
  PurchaseOrderItem ||--o{ GoodsReceiptItem : "grnItems"
  PurchaseOrderItem ||--o{ SupplierInvoiceItem : "invoiceItems"
  GoodsReceipt }|--|| PurchaseOrder : "po"
  GoodsReceipt ||--o{ GoodsReceiptItem : "items"
  GoodsReceipt ||--o{ SupplierInvoice : "supplierInvoices"
  GoodsReceiptItem }|--|| GoodsReceipt : "grn"
  GoodsReceiptItem }|--|| PurchaseOrderItem : "poItem"
  GoodsReceiptItem }|--|| Product : "product"
  GoodsReceiptItem ||--o{ SupplierInvoiceItem : "invoiceItems"
  SupplierInvoice }|--|| Vendor : "vendor"
  SupplierInvoice }|--|| PurchaseOrder : "po"
  SupplierInvoice }|--|| GoodsReceipt : "grn"
  SupplierInvoice ||--o{ SupplierInvoiceItem : "items"
  SupplierInvoice ||--o{ SupplierPayment : "payments"
  SupplierInvoiceItem }|--|| SupplierInvoice : "invoice"
  SupplierInvoiceItem }|--|| PurchaseOrderItem : "poItem"
  SupplierInvoiceItem }|--|| GoodsReceiptItem : "grnItem"
  SupplierInvoiceItem }|--|| Product : "product"
  SupplierPayment }|--|| SupplierInvoice : "supplierInvoice"
  SupplierPayment }|--|| Vendor : "vendor"
  PosSale ||--o{ PosSaleItem : "items"
  PosSaleItem }|--|| PosSale : "sale"
  PosSaleItem }|--|| Product : "product"
  Vendor ||--o{ PurchaseOrder : "purchaseOrders"
  Vendor ||--o{ VendorLedgerEntry : "vendorLedgerEntries"
  Vendor ||--o{ RfqVendor : "rfqVendors"
  Vendor ||--o{ SupplierInvoice : "supplierInvoices"
  Vendor ||--o{ SupplierPayment : "supplierPayments"
  CustomerLedgerEntry }|--|| Customer : "customer"
  VendorLedgerEntry }|--|| Vendor : "vendor"
  Employee }|--|| Employee : "reportingManager"
  Employee ||--o{ Employee : "directReports"
  Employee ||--o{ Job : "jobs"
  Employee ||--o{ AttendanceLog : "attendanceLogs"
  Employee ||--o{ EmployeeAdvance : "advances"
  Employee ||--o{ Payslip : "payslips"
  Employee ||--o{ ProjectTask : "projectTasks"
  Employee ||--o{ LeaveBalance : "leaveBalances"
  Employee ||--o{ LeaveRequest : "leaveRequests"
  Employee ||--o{ AssetAssignment : "assetAssignments"
  Employee ||--o{ OnboardingChecklist : "onboardingChecklists"
  Employee ||--o{ OffboardingChecklist : "offboardingChecklists"
  Employee }|--|| ExitInterview : "exitInterview"
  Employee ||--o{ FinalSettlement : "finalSettlements"
  Employee ||--o{ GrievanceTicket : "grievanceTickets"
  Employee ||--o{ DevicePushToken : "pushTokens"
  Employee ||--o{ MobileAppRequest : "receivedAppRequests"
  GeofenceZone ||--o{ AttendanceLog : "logs"
  AttendanceLog }|--|| Employee : "employee"
  AttendanceLog }|--|| GeofenceZone : "geofenceZone"
  EmployeeAdvance }|--|| Employee : "employee"
  PayrollRun ||--o{ Payslip : "payslips"
  Payslip }|--|| PayrollRun : "payrollRun"
  Payslip }|--|| Employee : "employee"
  Project }|--|| Customer : "customer"
  Project ||--o{ BOQItem : "boqItems"
  Project ||--o{ ProjectTask : "tasks"
  BOQItem }|--|| Project : "project"
  BOQItem ||--o{ ProjectTask : "tasks"
  ProjectTask }|--|| Project : "project"
  ProjectTask }|--|| BOQItem : "boqItem"
  ProjectTask }|--|| Employee : "assignedTechnician"
  FeedbackCall }|--|| Job : "job"
  JobRequisition ||--o{ Candidate : "candidates"
  Candidate }|--|| JobRequisition : "requisition"
  Candidate ||--o{ CandidateInterview : "interviews"
  Candidate ||--o{ Offer : "offers"
  CandidateInterview }|--|| Candidate : "candidate"
  Offer }|--|| Candidate : "candidate"
  OnboardingChecklist }|--|| Employee : "employee"
  OffboardingChecklist }|--|| Employee : "employee"
  ExitInterview }|--|| Employee : "employee"
  FinalSettlement }|--|| Employee : "employee"
  LeaveType ||--o{ LeaveBalance : "balances"
  LeaveType ||--o{ LeaveRequest : "requests"
  LeaveBalance }|--|| Employee : "employee"
  LeaveBalance }|--|| LeaveType : "leaveType"
  LeaveRequest }|--|| Employee : "employee"
  LeaveRequest }|--|| LeaveType : "leaveType"
  Asset ||--o{ AssetAssignment : "assignments"
  AssetAssignment }|--|| Asset : "asset"
  AssetAssignment }|--|| Employee : "employee"
  GrievanceTicket }|--|| Employee : "employee"
  GrievanceTicket ||--o{ GrievanceComment : "comments"
  GrievanceTicket ||--o{ GrievanceStatusHistory : "statusHistory"
  GrievanceComment }|--|| GrievanceTicket : "ticket"
  GrievanceStatusHistory }|--|| GrievanceTicket : "ticket"
  DevicePushToken }|--|| Employee : "employee"
  MobileAppRequest }|--|| Employee : "recipient"
```
