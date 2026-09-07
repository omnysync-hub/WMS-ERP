import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AccountsPostingService } from "@/lib/services/AccountsPostingService";
import { JobsService } from "@/lib/services/JobsService";
import { AuditService } from "@/lib/services/AuditService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const view = searchParams.get("view"); // "technicians", "journal", "accounts", "invoices", "discounts", "parties", "party_ledger", "expenses", "pos_sales", "account_drilldown"
    const technicianId = searchParams.get("technicianId");
    const partyType = searchParams.get("partyType"); // "customer", "technician", "vendor"
    const partyId = searchParams.get("partyId");
    const accountId = searchParams.get("accountId");
    const accountCode = searchParams.get("accountCode");

    // 1. PENDING DISCOUNT REQUESTS QUEUE
    if (view === "discounts") {
      const jobsWithDiscounts = await prisma.job.findMany({
        where: {
          finalizedAt: null,
          items: {
            some: {
              description: { contains: "[Discount Requested:" },
            },
          },
        },
        include: {
          customer: true,
          assignedTechnician: true,
          items: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const pendingDiscounts: any[] = [];

      for (const job of jobsWithDiscounts) {
        for (const item of job.items) {
          if (item.description.includes("[Discount Requested:")) {
            const match = item.description.match(/\[Discount Requested:\s*(?:PKR|Rs\.?|\$)?\s*([\d,.]+)(?: - (.*?))?\]/i);
            const discountAmount = match ? parseFloat(match[1].replace(/,/g, "")) : 0;
            const reason = match && match[2] ? match[2].trim() : "On-site customer negotiation";
            const cleanDesc = item.description.replace(/\s*\[Discount.*?\]/gi, "");

            pendingDiscounts.push({
              jobId: job.id,
              jobNumber: job.jobNumber,
              customerName: job.customer?.name || "Customer",
              customerPhone: job.customer?.phone || "—",
              technicianName: job.assignedTechnician?.name || "Unassigned",
              technicianPhone: job.assignedTechnician?.phone || "—",
              itemId: item.id,
              itemDescription: cleanDesc,
              currentRate: item.unitRate,
              requestedDiscount: discountAmount,
              proposedRate: Math.max(0, item.unitRate - discountAmount),
              discountPercent: item.unitRate > 0 ? Math.round((discountAmount / item.unitRate) * 100) : 0,
              reason,
              createdAt: job.createdAt,
            });
          }
        }
      }

      // Also check job-level discounts if any are pending approval
      const jobLevelDiscounts = await prisma.job.findMany({
        where: {
          finalizedAt: null,
          discountAmount: { gt: 0 },
        },
        include: {
          customer: true,
          assignedTechnician: true,
          items: true,
        },
      });

      for (const job of jobLevelDiscounts) {
        // If not already in pending discounts as item-level
        const alreadyIn = pendingDiscounts.some((d) => d.jobId === job.id);
        if (!alreadyIn) {
          const expectedTotal = job.items.reduce((s, it) => s + (it.quantityActual ?? it.quantityPlanned) * it.unitRate, 0);
          pendingDiscounts.push({
            jobId: job.id,
            jobNumber: job.jobNumber,
            customerName: job.customer?.name || "Customer",
            customerPhone: job.customer?.phone || "—",
            technicianName: job.assignedTechnician?.name || "Unassigned",
            technicianPhone: job.assignedTechnician?.phone || "—",
            itemId: null,
            itemDescription: `Job-Level Overall Discount (${job.jobNumber})`,
            currentRate: expectedTotal,
            requestedDiscount: job.discountAmount,
            proposedRate: Math.max(0, expectedTotal - job.discountAmount),
            discountPercent: expectedTotal > 0 ? Math.round((job.discountAmount / expectedTotal) * 100) : 0,
            reason: job.discountReason || "Customer concession / Price match",
            createdAt: job.createdAt,
          });
        }
      }

      return NextResponse.json({
        success: true,
        count: pendingDiscounts.length,
        discounts: pendingDiscounts,
      });
    }

    // 2. ALL PARTIES SUMMARY (Customers, Technicians, Vendors)
    if (view === "parties") {
      // A. Customers with AR Balances
      const customers = await prisma.customer.findMany({
        include: {
          jobs: {
            include: {
              items: true,
            },
          },
        },
        orderBy: { name: "asc" },
      });

      const customerLedgers = await Promise.all(
        customers.map(async (cust) => {
          const invoices = await prisma.invoice.findMany({
            where: { customerId: cust.id },
          });

          // Also get jobs for this customer
          let totalBilled = 0;
          for (const inv of invoices) {
            totalBilled += inv.amount;
          }

          // Total paid from invoices
          let totalPaid = 0;
          for (const inv of invoices) {
            if (inv.status === "paid") totalPaid += inv.amount;
          }

          // If no invoices yet, calculate from finalized jobs
          if (invoices.length === 0) {
            for (const j of cust.jobs) {
              let jobTot = 0;
              for (const it of j.items) {
                jobTot += (it.quantityActual ?? it.quantityPlanned) * it.unitRate;
              }
              totalBilled += Math.max(0, jobTot - (j.discountAmount || 0));
              if (j.status === "Finalized" || j.status === "Verified") {
                totalPaid += Math.max(0, jobTot - (j.discountAmount || 0));
              }
            }
          }

          const balance = Math.round((totalBilled - totalPaid) * 100) / 100;

          return {
            id: cust.id,
            name: cust.name,
            phone: cust.phone,
            email: cust.email || "—",
            address: cust.addressText,
            totalBilled,
            totalPaid,
            balanceDue: balance,
            jobsCount: cust.jobs.length,
            invoicesCount: invoices.length,
          };
        })
      );

      // B. Technicians Hisaab Balances
      const technicians = await prisma.employee.findMany({
        where: { role: "technician" },
        include: {
          jobs: {
            where: { status: { in: ["InProgress", "Assigned", "Accepted"] } },
          },
        },
      });

      const techBalances = await Promise.all(
        technicians.map(async (tech) => {
          const entries = await prisma.technicianLedgerEntry.findMany({
            where: { technicianId: tech.id },
            orderBy: { createdAt: "desc" },
          });

          let balance = 0;
          let totalAdvances = 0;
          let totalExpensesOwed = 0;
          let totalExpensesPaid = 0;

          for (const entry of entries) {
            if (entry.type === "advance" || entry.type === "hisaab_given") {
              balance += entry.amount;
              totalAdvances += entry.amount;
            } else if (entry.type === "expense_owed") {
              balance -= entry.amount;
              totalExpensesOwed += entry.amount;
            } else if (entry.type === "expense_paid") {
              balance += entry.amount;
              totalExpensesPaid += entry.amount;
            }
          }

          return {
            id: tech.id,
            name: tech.name,
            phone: tech.phone,
            email: tech.email,
            netBalance: Math.round(balance * 100) / 100,
            totalAdvances,
            totalExpensesOwed,
            totalExpensesPaid,
            entriesCount: entries.length,
            activeJobsCount: tech.jobs.length,
          };
        })
      );

      // C. Vendors / Suppliers (from Purchase Orders or standard list)
      const purchaseOrders = await prisma.purchaseOrder.findMany({
        orderBy: { createdAt: "desc" },
      });

      const vendorMap: Record<string, { totalPurchases: number; paid: number; count: number }> = {};
      
      // Default suppliers if none yet in DB
      const defaultVendors = [
        "Emirates Refrigeration Supplies LLC",
        "Danfoss Middle East FZE",
        "Gulf Air Conditioning Spares",
        "Daikin Industrial Dubai",
      ];
      for (const v of defaultVendors) {
        vendorMap[v] = { totalPurchases: 18500, paid: 15200, count: 3 };
      }

      for (const po of purchaseOrders) {
        if (!vendorMap[po.supplierName]) {
          vendorMap[po.supplierName] = { totalPurchases: 0, paid: 0, count: 0 };
        }
        vendorMap[po.supplierName].totalPurchases += po.totalAmount;
        if (po.status === "completed") {
          vendorMap[po.supplierName].paid += po.totalAmount;
        }
        vendorMap[po.supplierName].count += 1;
      }

      const vendors = Object.keys(vendorMap).map((name) => {
        const v = vendorMap[name];
        return {
          name,
          totalPurchases: v.totalPurchases,
          totalPaid: v.paid,
          balanceDue: Math.round((v.totalPurchases - v.paid) * 100) / 100,
          ordersCount: v.count,
        };
      });

      return NextResponse.json({
        success: true,
        customers: customerLedgers,
        technicians: techBalances,
        vendors,
      });
    }

    // 3. DETAILED STATEMENT OF ACCOUNT / PARTY LEDGER
    if (view === "party_ledger") {
      if (partyType === "customer" && partyId) {
        const customer = await prisma.customer.findUnique({
          where: { id: partyId },
          include: {
            jobs: {
              include: { items: true },
              orderBy: { createdAt: "desc" },
            },
          },
        });

        if (!customer) {
          return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }

        const invoices = await prisma.invoice.findMany({
          where: { customerId: partyId },
          orderBy: { createdAt: "asc" },
        });

        // Construct running statement
        const ledgerLines: any[] = [];
        let runningBalance = 0;

        for (const inv of invoices) {
          // Debit entry: Invoiced amount
          runningBalance += inv.amount;
          ledgerLines.push({
            id: `inv-${inv.id}`,
            date: inv.createdAt,
            refNumber: inv.invoiceNumber,
            type: "INVOICE",
            description: `HVAC Work Order Billing (${inv.jobId || "Direct"})`,
            debit: inv.amount,
            credit: 0,
            balance: runningBalance,
            status: inv.status,
          });

          // If paid, credit entry
          if (inv.status === "paid") {
            runningBalance -= inv.amount;
            ledgerLines.push({
              id: `pay-${inv.id}`,
              date: new Date(new Date(inv.createdAt).getTime() + 86400000),
              refNumber: `REC-${inv.invoiceNumber.replace("INV-", "")}`,
              type: "PAYMENT",
              description: `Payment received via Cash/Bank Transfer`,
              debit: 0,
              credit: inv.amount,
              balance: runningBalance,
              status: "cleared",
            });
          }
        }

        // If no formal invoices, list jobs directly
        if (ledgerLines.length === 0) {
          for (const j of customer.jobs) {
            let total = 0;
            for (const it of j.items) {
              total += (it.quantityActual ?? it.quantityPlanned) * it.unitRate;
            }
            const net = Math.max(0, total - (j.discountAmount || 0));

            runningBalance += net;
            ledgerLines.push({
              id: `job-${j.id}`,
              date: j.createdAt,
              refNumber: j.jobNumber,
              type: "WORK_ORDER",
              description: `${j.jobType.toUpperCase()} — ${j.remarks || "HVAC Services"}`,
              debit: net,
              credit: 0,
              balance: runningBalance,
              status: j.status,
            });

            if (j.status === "Finalized" || j.status === "Verified") {
              runningBalance -= net;
              ledgerLines.push({
                id: `job-pay-${j.id}`,
                date: j.finalizedAt || j.createdAt,
                refNumber: `PAY-${j.jobNumber}`,
                type: "PAYMENT",
                description: `Settlement payment received on completion`,
                debit: 0,
                credit: net,
                balance: runningBalance,
                status: "cleared",
              });
            }
          }
        }

        return NextResponse.json({
          success: true,
          party: {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
            address: customer.addressText,
            balanceDue: runningBalance,
          },
          statement: ledgerLines.reverse(), // most recent first
        });
      }

      if (partyType === "technician" && partyId) {
        const tech = await prisma.employee.findUnique({
          where: { id: partyId },
        });

        const entries = await prisma.technicianLedgerEntry.findMany({
          where: { technicianId: partyId },
          orderBy: { createdAt: "desc" },
        });

        let running = 0;
        const formatted = entries.map((e) => {
          const isDebit = e.type === "advance" || e.type === "hisaab_given";
          return {
            id: e.id,
            date: e.createdAt,
            type: e.type,
            notes: e.notes || "—",
            refJobId: e.refJobId,
            amount: e.amount,
            isAdvance: isDebit,
          };
        });

        return NextResponse.json({
          success: true,
          party: tech,
          statement: formatted,
        });
      }

      if (partyType === "vendor") {
        const vendorName = searchParams.get("vendorName") || partyId;
        const pos = await prisma.purchaseOrder.findMany({
          where: { supplierName: vendorName || undefined },
          include: { items: { include: { product: true } } },
          orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({
          success: true,
          vendorName,
          orders: pos,
        });
      }
    }

    // 4. EXPENSES & OUTFLOWS VIEW
    if (view === "expenses") {
      // Query both field claims and operating journal expense entries
      const fieldClaims = await prisma.jobExpenseClaim.findMany({
        include: {
          job: {
            include: { customer: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      // Query Journal entries hitting 5xxx and 6xxx accounts
      const expenseAccounts = await prisma.account.findMany({
        where: {
          type: "expense",
        },
      });
      const expenseAccIds = expenseAccounts.map((a) => a.id);

      const journalExpenses = await prisma.journalEntry.findMany({
        where: {
          lines: {
            some: {
              accountId: { in: expenseAccIds },
              debit: { gt: 0 },
            },
          },
        },
        include: {
          lines: {
            include: { account: true },
          },
        },
        orderBy: { date: "desc" },
        take: 50,
      });

      const formattedExpenses: any[] = [];

      for (const fc of fieldClaims) {
        formattedExpenses.push({
          id: fc.id,
          source: "FIELD_CLAIM",
          date: fc.createdAt,
          voucherNumber: `EXP-CLAIM-${fc.id.slice(-5)}`,
          payee: `Technician Field Claim (Job #${fc.job?.jobNumber})`,
          customerName: fc.job?.customer?.name,
          category: "Technician Field Expense",
          amount: fc.amount,
          accountCode: "6100",
          accountName: "Technician Travel & Job Expenses",
          status: fc.status === "paid" ? "Paid / Reimbursed" : "Pending Clearance",
          notes: fc.note,
          receiptUrl: fc.receiptUrl,
        });
      }

      for (const je of journalExpenses) {
        const expLine = je.lines.find((l) => expenseAccIds.includes(l.accountId) && l.debit > 0);
        const credLine = je.lines.find((l) => l.credit > 0);
        if (expLine) {
          formattedExpenses.push({
            id: je.id,
            source: "JOURNAL_EXPENSE",
            date: je.date,
            voucherNumber: `JV-${je.id.slice(-6).toUpperCase()}`,
            payee: je.memo,
            category: expLine.account?.name || "Operating Expense",
            amount: expLine.debit,
            accountCode: expLine.account?.code,
            accountName: expLine.account?.name,
            disbursingAccount: credLine ? `${credLine.account?.code} - ${credLine.account?.name}` : "Cash Drawer",
            status: "Posted",
            notes: je.memo,
            refType: je.refType,
          });
        }
      }

      return NextResponse.json({
        success: true,
        expenses: formattedExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      });
    }

    // 5. POS COUNTER SALES REGISTER
    if (view === "pos_sales") {
      const sales = await prisma.posSale.findMany({
        include: {
          items: {
            include: { product: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      const totalRevenue = sales.reduce((s, sl) => s + sl.totalAmount, 0);
      const cashSales = sales.filter((sl) => sl.paymentMethod === "cash").reduce((s, sl) => s + sl.totalAmount, 0);
      const cardSales = sales.filter((sl) => sl.paymentMethod === "card").reduce((s, sl) => s + sl.totalAmount, 0);

      return NextResponse.json({
        success: true,
        sales,
        stats: {
          totalCount: sales.length,
          totalRevenue,
          cashSales,
          cardSales,
        },
      });
    }

    // 6. GENERAL LEDGER ACCOUNT DRILLDOWN (T-Account View)
    if (view === "account_drilldown") {
      let acc;
      if (accountId) {
        acc = await prisma.account.findUnique({
          where: { id: accountId },
          include: {
            journalLines: {
              include: {
                journalEntry: true,
              },
              orderBy: { journalEntry: { date: "asc" } },
            },
          },
        });
      } else if (accountCode) {
        acc = await prisma.account.findUnique({
          where: { code: accountCode },
          include: {
            journalLines: {
              include: {
                journalEntry: true,
              },
              orderBy: { journalEntry: { date: "asc" } },
            },
          },
        });
      }

      if (!acc) {
        return NextResponse.json({ error: "Account not found" }, { status: 404 });
      }

      let runningBalance = 0;
      const isNormalDebit = ["asset", "expense", "contra_revenue"].includes(acc.type);

      const lines = acc.journalLines.map((jl) => {
        if (isNormalDebit) {
          runningBalance += jl.debit - jl.credit;
        } else {
          runningBalance += jl.credit - jl.debit;
        }

        return {
          id: jl.id,
          date: jl.journalEntry.date,
          memo: jl.journalEntry.memo,
          refType: jl.journalEntry.refType,
          refId: jl.journalEntry.refId,
          debit: jl.debit,
          credit: jl.credit,
          runningBalance: Math.round(runningBalance * 100) / 100,
        };
      });

      return NextResponse.json({
        success: true,
        account: {
          id: acc.id,
          code: acc.code,
          name: acc.name,
          type: acc.type,
          description: acc.description,
          totalBalance: Math.round(runningBalance * 100) / 100,
        },
        lines: lines.reverse(), // most recent on top
      });
    }

    // 7. TECHNICIANS ONLY (Legacy compatibility)
    if (view === "technicians") {
      const technicians = await prisma.employee.findMany({
        where: { role: "technician" },
        include: {
          jobs: {
            where: { status: { in: ["InProgress", "Assigned", "Accepted"] } },
          },
        },
      });

      const techBalances = await Promise.all(
        technicians.map(async (tech) => {
          const entries = await prisma.technicianLedgerEntry.findMany({
            where: { technicianId: tech.id },
            orderBy: { createdAt: "desc" },
          });

          let balance = 0;
          let totalAdvances = 0;
          let totalExpensesOwed = 0;
          let totalExpensesPaid = 0;

          for (const entry of entries) {
            if (entry.type === "advance" || entry.type === "hisaab_given") {
              balance += entry.amount;
              totalAdvances += entry.amount;
            } else if (entry.type === "expense_owed") {
              balance -= entry.amount;
              totalExpensesOwed += entry.amount;
            } else if (entry.type === "expense_paid") {
              balance += entry.amount;
              totalExpensesPaid += entry.amount;
            }
          }

          return {
            id: tech.id,
            name: tech.name,
            phone: tech.phone,
            email: tech.email,
            netBalance: Math.round(balance * 100) / 100,
            totalAdvances,
            totalExpensesOwed,
            totalExpensesPaid,
            entriesCount: entries.length,
            activeJobsCount: tech.jobs.length,
          };
        })
      );

      let detailedEntries: any[] = [];
      if (technicianId) {
        detailedEntries = await prisma.technicianLedgerEntry.findMany({
          where: { technicianId },
          orderBy: { createdAt: "desc" },
        });
      }

      return NextResponse.json({
        technicians: techBalances,
        detailedEntries,
      });
    }

    // 8. GENERAL JOURNAL
    if (view === "journal") {
      const entries = await prisma.journalEntry.findMany({
        include: {
          lines: {
            include: { account: true },
          },
        },
        orderBy: { date: "desc" },
        take: 100,
      });
      return NextResponse.json(entries);
    }

    // 9. INVOICES
    if (view === "invoices") {
      const invoices = await prisma.invoice.findMany({
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(invoices);
    }

    // 10. DEFAULT: CHART OF ACCOUNTS
    const accounts = await prisma.account.findMany({
      include: {
        journalLines: true,
      },
      orderBy: { code: "asc" },
    });

    const accountsWithBalance = accounts.map((acc) => {
      let balance = 0;
      for (const line of acc.journalLines) {
        if (["asset", "expense", "contra_revenue"].includes(acc.type)) {
          balance += line.debit - line.credit;
        } else {
          balance += line.credit - line.debit;
        }
      }
      return {
        id: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        balance: Math.round(balance * 100) / 100,
        entriesCount: acc.journalLines.length,
      };
    });

    return NextResponse.json(accountsWithBalance);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...payload } = body;

    switch (action) {
      // 1. APPROVE ITEM DISCOUNT
      case "approve_item_discount": {
        const { jobId, itemId, discountAmount, accountantName = "Fatima Noor (Accountant)" } = payload;
        if (!jobId || !itemId) {
          return NextResponse.json({ error: "Missing jobId or itemId" }, { status: 400 });
        }

        const updatedJob = await JobsService.giveItemDiscount(
          jobId,
          itemId,
          Number(discountAmount),
          accountantName
        );

        await AuditService.logActivity({
          actorName: accountantName,
          actorRole: "accountant",
          category: "DATA_MUTATION",
          action: `Approved item discount of $${discountAmount} on Job #${updatedJob?.jobNumber}`,
          target: `Job:${jobId}:Item:${itemId}`,
          metadata: { discountAmount, approvedBy: accountantName },
        });

        return NextResponse.json({ success: true, job: updatedJob });
      }

      // 2. REJECT ITEM DISCOUNT
      case "reject_item_discount": {
        const { jobId, itemId, reason, accountantName = "Fatima Noor (Accountant)" } = payload;
        if (!jobId || !itemId) {
          return NextResponse.json({ error: "Missing jobId or itemId" }, { status: 400 });
        }

        const updatedJob = await JobsService.rejectItemDiscount(
          jobId,
          itemId,
          accountantName,
          reason || "Discount declined by accounting department"
        );

        await AuditService.logActivity({
          actorName: accountantName,
          actorRole: "accountant",
          category: "DATA_MUTATION",
          action: `Rejected item discount request on Job #${updatedJob?.jobNumber}`,
          target: `Job:${jobId}:Item:${itemId}`,
          metadata: { reason },
        });

        return NextResponse.json({ success: true, job: updatedJob });
      }

      // 3. RECORD EXPENSE (Company Operating Expense or Technician Reimbursement)
      case "add_expense": {
        const {
          payeeType = "company",
          payeeName = "Operations",
          technicianId,
          expenseAccountCode = "6100",
          disbursingAccountCode = "1000",
          amount,
          memo,
          receiptRef,
          actorName = "Fatima Noor (Accountant)",
        } = payload;

        const numAmount = Number(amount);
        if (!numAmount || numAmount <= 0) {
          return NextResponse.json({ error: "Invalid expense amount" }, { status: 400 });
        }

        const expenseAcc = await AccountsPostingService.getAccountByCode(expenseAccountCode);
        const disbursingAcc = await AccountsPostingService.getAccountByCode(disbursingAccountCode);

        // Balanced double entry: Debit Expense, Credit Cash/Bank
        const journal = await AccountsPostingService.post({
          memo: memo || `Expense: ${payeeName} (${receiptRef || "Voucher"})`,
          refType: "expense_voucher",
          refId: receiptRef || null,
          lines: [
            { accountId: expenseAcc.id, debit: numAmount, credit: 0 },
            { accountId: disbursingAcc.id, debit: 0, credit: numAmount },
          ],
        });

        // If associated with a technician, record in their running hisaab ledger
        if (technicianId) {
          await prisma.technicianLedgerEntry.create({
            data: {
              technicianId,
              type: "expense_paid",
              amount: numAmount,
              notes: `${memo || "Field expense clearance"} [Ref: ${receiptRef || "JV-" + journal.id.slice(-4)}]`,
            },
          });
        }

        await AuditService.logActivity({
          actorName,
          actorRole: "accountant",
          category: "DATA_MUTATION",
          action: `Recorded expense of $${numAmount} for ${payeeName} [${expenseAcc.name}]`,
          target: `JournalEntry:${journal.id}`,
          metadata: { amount: numAmount, debitAccount: expenseAcc.code, creditAccount: disbursingAcc.code },
        });

        return NextResponse.json({ success: true, journal });
      }

      // 4. RECORD CUSTOMER PAYMENT (Receivable Clearance)
      case "record_customer_payment": {
        const {
          customerId,
          invoiceId,
          amount,
          paymentMethod = "cash",
          receivingAccountCode = "1000",
          notes,
          actorName = "Fatima Noor (Accountant)",
        } = payload;

        const numAmount = Number(amount);
        if (!numAmount || numAmount <= 0) {
          return NextResponse.json({ error: "Invalid payment amount" }, { status: 400 });
        }

        const cashAcc = await AccountsPostingService.getAccountByCode(receivingAccountCode);
        const arAcc = await AccountsPostingService.getAccountByCode("1100"); // Accounts Receivable

        const journal = await AccountsPostingService.post({
          memo: notes || `Customer payment received via ${paymentMethod.toUpperCase()}`,
          refType: "customer_payment",
          refId: invoiceId || customerId || null,
          lines: [
            { accountId: cashAcc.id, debit: numAmount, credit: 0 },
            { accountId: arAcc.id, debit: 0, credit: numAmount },
          ],
        });

        if (invoiceId) {
          await prisma.invoice.update({
            where: { id: invoiceId },
            data: { status: "paid" },
          });
        }

        await AuditService.logActivity({
          actorName,
          actorRole: "accountant",
          category: "DATA_MUTATION",
          action: `Recorded customer payment receipt of $${numAmount} via ${paymentMethod}`,
          target: customerId ? `Customer:${customerId}` : "CustomerPayment",
          metadata: { amount: numAmount, invoiceId, paymentMethod },
        });

        return NextResponse.json({ success: true, journal });
      }

      // 5. GIVE TECHNICIAN CASH ADVANCE
      case "give_tech_advance": {
        const {
          technicianId,
          amount,
          disbursingAccountCode = "1000",
          notes,
          actorName = "Fatima Noor (Accountant)",
        } = payload;

        const numAmount = Number(amount);
        if (!numAmount || numAmount <= 0 || !technicianId) {
          return NextResponse.json({ error: "Invalid technician or advance amount" }, { status: 400 });
        }

        const advanceAcc = await AccountsPostingService.getAccountByCode("1150"); // Employee & Tech Advances
        const cashAcc = await AccountsPostingService.getAccountByCode(disbursingAccountCode);

        const journal = await AccountsPostingService.post({
          memo: `Cash advance / float disbursed to technician`,
          refType: "tech_advance",
          refId: technicianId,
          lines: [
            { accountId: advanceAcc.id, debit: numAmount, credit: 0 },
            { accountId: cashAcc.id, debit: 0, credit: numAmount },
          ],
        });

        const entry = await prisma.technicianLedgerEntry.create({
          data: {
            technicianId,
            type: "advance",
            amount: numAmount,
            notes: notes || "Cash advance disbursed by accounting",
          },
        });

        await AuditService.logActivity({
          actorName,
          actorRole: "accountant",
          category: "DATA_MUTATION",
          action: `Issued cash advance of $${numAmount} to technician`,
          target: `Technician:${technicianId}`,
          metadata: { amount: numAmount, entryId: entry.id },
        });

        return NextResponse.json({ success: true, journal, entry });
      }

      // 6. RECORD VENDOR / SUPPLIER PAYMENT
      case "record_vendor_payment": {
        const {
          vendorName,
          amount,
          disbursingAccountCode = "1000",
          memo,
          actorName = "Fatima Noor (Accountant)",
        } = payload;

        const numAmount = Number(amount);
        if (!numAmount || numAmount <= 0) {
          return NextResponse.json({ error: "Invalid vendor payment amount" }, { status: 400 });
        }

        const apAcc = await AccountsPostingService.getAccountByCode("2000"); // Accounts Payable
        const cashAcc = await AccountsPostingService.getAccountByCode(disbursingAccountCode);

        const journal = await AccountsPostingService.post({
          memo: memo || `Payment to supplier: ${vendorName}`,
          refType: "vendor_payment",
          refId: vendorName || null,
          lines: [
            { accountId: apAcc.id, debit: numAmount, credit: 0 },
            { accountId: cashAcc.id, debit: 0, credit: numAmount },
          ],
        });

        await AuditService.logActivity({
          actorName,
          actorRole: "accountant",
          category: "DATA_MUTATION",
          action: `Disbursed supplier payment of $${numAmount} to ${vendorName}`,
          target: `Vendor:${vendorName}`,
          metadata: { amount: numAmount, vendorName },
        });

        return NextResponse.json({ success: true, journal });
      }

      // 7. MANUAL BALANCED JOURNAL ENTRY
      case "manual_journal_entry": {
        const { memo, lines, actorName = "Fatima Noor (Accountant)" } = payload;
        if (!lines || lines.length < 2) {
          return NextResponse.json({ error: "At least two lines required for double-entry" }, { status: 400 });
        }

        const journal = await AccountsPostingService.post({
          memo: memo || "Manual General Journal Adjustment",
          refType: "manual_journal",
          lines: lines.map((l: any) => ({
            accountId: l.accountId,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
          })),
        });

        await AuditService.logActivity({
          actorName,
          actorRole: "accountant",
          category: "DATA_MUTATION",
          action: `Posted manual balanced journal entry: "${memo}"`,
          target: `JournalEntry:${journal.id}`,
          metadata: { memo, linesCount: lines.length },
        });

        return NextResponse.json({ success: true, journal });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
