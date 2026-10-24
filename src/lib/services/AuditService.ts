import { prisma } from "@/lib/prisma";
import { AccountsPostingService } from "./AccountsPostingService";

export interface LogActivityParams {
  actorName: string;
  actorRole: string;
  actorId?: string;
  category: "UI_CLICK" | "NAVIGATION" | "DATA_MUTATION" | "ROLE_SWITCH" | "SEARCH" | "MODAL" | "EXPORT" | "SYSTEM_SYNC";
  action: string;
  target?: string;
  metadata?: any;
  ipAddress?: string;
}

export interface LogRollbackParams {
  entityType: "Job" | "JobItem" | "Customer" | "Employee" | "Product" | "InventoryRequest" | "StockReturn" | "Discount" | "Expense" | "JournalEntry" | "FeedbackCall" | string;
  entityId: string;
  entityNumber?: string;
  action: string;
  actorName: string;
  actorRole: string;
  stateBefore: any;
  stateAfter: any;
  canRollback?: boolean;
  reason?: string;
}

export interface RecordCrudParams {
  actorName: string;
  actorRole: string;
  actorId?: string;
  entityType: "Job" | "JobItem" | "Customer" | "Employee" | "Product" | "InventoryRequest" | "StockReturn" | "Discount" | "Expense" | "JournalEntry" | "FeedbackCall" | string;
  entityId: string;
  entityNumber?: string;
  actionType: "CREATE" | "UPDATE" | "DELETE" | "STATUS_CHANGE" | "FINANCIAL" | "INVENTORY";
  description: string;
  stateBefore?: any;
  stateAfter?: any;
  metadata?: any;
  ipAddress?: string;
  canRollback?: boolean;
}

export class AuditService {
  /**
   * Log fine-grained user activity, clicks, navigation, or role switches.
   */
  static async logActivity(params: LogActivityParams) {
    try {
      const log = await prisma.activityLog.create({
        data: {
          actorName: params.actorName || "System",
          actorRole: params.actorRole || "guest",
          actorId: params.actorId || null,
          category: params.category,
          action: params.action,
          target: params.target || null,
          metadata: params.metadata ? JSON.stringify(params.metadata) : null,
          ipAddress: params.ipAddress || "127.0.0.1 (Local Session)",
        },
      });
      return log;
    } catch (err) {
      console.error("Failed writing activity log", err);
      return null;
    }
  }

  /**
   * Record a state snapshot before and after a mutating action for rollback.
   */
  static async logRollbackSnapshot(params: LogRollbackParams) {
    try {
      const rollbackLog = await prisma.rollbackLog.create({
        data: {
          entityType: params.entityType,
          entityId: params.entityId,
          entityNumber: params.entityNumber || null,
          action: params.action,
          actorName: params.actorName,
          actorRole: params.actorRole,
          stateBefore: params.stateBefore !== undefined && params.stateBefore !== null ? JSON.stringify(params.stateBefore) : "null",
          stateAfter: params.stateAfter !== undefined && params.stateAfter !== null ? JSON.stringify(params.stateAfter) : "null",
          canRollback: params.canRollback ?? true,
          reason: params.reason || null,
          status: "ACTIVE",
        },
      });
      return rollbackLog;
    } catch (err) {
      console.error("Failed recording rollback snapshot", err);
      return null;
    }
  }

  /**
   * Unified CRUD and mutation auditor:
   * Writes both ActivityLog (telemetry) and reversible RollbackLog snapshot in one atomic call.
   */
  static async recordCrudAction(params: RecordCrudParams) {
    try {
      // 1. Write Activity Log (telemetry stream)
      await prisma.activityLog.create({
        data: {
          actorName: params.actorName || "System",
          actorRole: params.actorRole || "user",
          actorId: params.actorId || null,
          category: "DATA_MUTATION",
          action: params.description,
          target: `${params.entityType}:${params.entityId}`,
          metadata: JSON.stringify({
            actionType: params.actionType,
            entityType: params.entityType,
            entityNumber: params.entityNumber,
            ...params.metadata,
          }),
          ipAddress: params.ipAddress || "127.0.0.1 (Local Session)",
        },
      });

      // 2. Write Reversible Rollback Snapshot
      const rollbackLog = await prisma.rollbackLog.create({
        data: {
          entityType: params.entityType,
          entityId: params.entityId,
          entityNumber: params.entityNumber || null,
          action: params.description,
          actorName: params.actorName || "System",
          actorRole: params.actorRole || "user",
          stateBefore:
            params.stateBefore !== undefined && params.stateBefore !== null
              ? JSON.stringify(params.stateBefore)
              : "null",
          stateAfter:
            params.stateAfter !== undefined && params.stateAfter !== null
              ? JSON.stringify(params.stateAfter)
              : "null",
          canRollback: params.canRollback ?? true,
          reason: params.metadata?.reason || null,
          status: "ACTIVE",
        },
      });

      return rollbackLog;
    } catch (err) {
      console.error("[AuditService] Failed recording CRUD audit snapshot", err);
      return null;
    }
  }

  /**
   * Execute an atomic rollback reverting an entity back to its previous state.
   */
  static async executeRollback(rollbackLogId: string, rolledBackBy: string, reason?: string) {
    const log = await prisma.rollbackLog.findUnique({
      where: { id: rollbackLogId },
    });

    if (!log) throw new Error("Rollback record not found");
    if (log.status === "ROLLED_BACK") throw new Error("This action has already been rolled back");
    if (!log.canRollback) throw new Error("This action is marked as non-reversible");

    const stateBefore =
      log.stateBefore && log.stateBefore !== "null" ? JSON.parse(log.stateBefore) : null;
    const stateAfter =
      log.stateAfter && log.stateAfter !== "null" ? JSON.parse(log.stateAfter) : null;

    return prisma.$transaction(
      async (tx) => {
        // Claim first inside the same transaction so concurrent retries cannot apply the inverse twice.
        const claimed = await tx.rollbackLog.updateMany({
          where: { id: rollbackLogId, status: log.status },
          data: {
            status: "ROLLED_BACK",
            rolledBackAt: new Date(),
            rolledBackBy,
            reason: reason || "Rolled back by administrator",
          },
        });
        if (claimed.count === 0) {
          throw new Error("This action has already been rolled back or changed. Refresh and retry.");
        }

        // Revert entity based on entityType and stateBefore / stateAfter
        switch (log.entityType) {
          case "Job": {
            if (!stateBefore) {
              // Rollback of CREATED job -> mark Cancelled
              await tx.job.update({
                where: { id: log.entityId },
                data: {
                  status: "Cancelled",
                  remarks: `[ROLLED BACK]: Creation reverted by ${rolledBackBy}. ${reason || ""}`,
                },
              });
              await tx.jobStatusHistory.create({
                data: {
                  jobId: log.entityId,
                  fromStatus: stateAfter?.status || "Created",
                  toStatus: "Cancelled",
                  changedBy: rolledBackBy,
                  metaJson: JSON.stringify({ action: "audit_rollback_creation", rollbackLogId, reason }),
                },
              });
            } else {
              // Rollback of an update or status transition
              const updateData: any = {};
              if (stateBefore.status !== undefined) updateData.status = stateBefore.status;
              if (stateBefore.assignedTechnicianId !== undefined)
                updateData.assignedTechnicianId = stateBefore.assignedTechnicianId;
              if (stateBefore.discountAmount !== undefined)
                updateData.discountAmount = stateBefore.discountAmount;
              if (stateBefore.discountReason !== undefined)
                updateData.discountReason = stateBefore.discountReason;
              if (stateBefore.finalizedAt !== undefined)
                updateData.finalizedAt = stateBefore.finalizedAt ? new Date(stateBefore.finalizedAt) : null;
              if (stateBefore.verifiedAt !== undefined)
                updateData.verifiedAt = stateBefore.verifiedAt ? new Date(stateBefore.verifiedAt) : null;
              if (stateBefore.qualityFlag !== undefined) updateData.qualityFlag = stateBefore.qualityFlag;
              if (stateBefore.remarks !== undefined) updateData.remarks = stateBefore.remarks;

              await tx.job.update({
                where: { id: log.entityId },
                data: updateData,
              });

              if (stateBefore.status !== undefined) {
                await tx.jobStatusHistory.create({
                  data: {
                    jobId: log.entityId,
                    fromStatus: stateAfter?.status || "Unknown",
                    toStatus: stateBefore.status,
                    changedBy: rolledBackBy,
                    metaJson: JSON.stringify({ action: "audit_rollback", rollbackLogId, reason }),
                  },
                });
              }

              // If items were snapshotted, restore them
              if (stateBefore.items && Array.isArray(stateBefore.items)) {
                for (const it of stateBefore.items) {
                  if (it.id) {
                    await tx.jobItem.updateMany({
                      where: { id: it.id },
                      data: {
                        quantityActual: it.quantityActual ?? null,
                        quantityPlanned: it.quantityPlanned ?? 1,
                        unitRate: it.unitRate,
                        description: it.description,
                      },
                    });
                  }
                }
              }
            }
            break;
          }

          case "JobItem": {
            if (!stateBefore) {
              // Rollback created item -> delete item
              await tx.jobItem.deleteMany({ where: { id: log.entityId } });
            } else if (!stateAfter) {
              // Rollback deleted item -> resurrect item
              await tx.jobItem.create({
                data: {
                  id: stateBefore.id || log.entityId,
                  jobId: stateBefore.jobId,
                  description: stateBefore.description,
                  quantityPlanned: stateBefore.quantityPlanned ?? 1,
                  quantityActual: stateBefore.quantityActual ?? null,
                  unitRate: stateBefore.unitRate ?? 0,
                },
              });
            } else {
              // Rollback updated item -> restore previous fields
              await tx.jobItem.update({
                where: { id: log.entityId },
                data: {
                  description: stateBefore.description,
                  quantityPlanned: stateBefore.quantityPlanned,
                  quantityActual: stateBefore.quantityActual,
                  unitRate: stateBefore.unitRate,
                },
              });
            }
            break;
          }

          case "Customer": {
            if (!stateBefore) {
              // Rollback created customer -> flag addressText
              await tx.customer.updateMany({
                where: { id: log.entityId },
                data: { addressText: `[ROLLED BACK]: Creation reverted by ${rolledBackBy}` },
              });
            } else if (!stateAfter) {
              // Rollback deleted customer -> resurrect
              await tx.customer.create({
                data: {
                  id: stateBefore.id || log.entityId,
                  name: stateBefore.name,
                  phone: stateBefore.phone,
                  email: stateBefore.email,
                  addressText: stateBefore.addressText,
                  lat: stateBefore.lat,
                  lng: stateBefore.lng,
                },
              });
            } else {
              // Rollback updated customer -> restore previous details
              await tx.customer.update({
                where: { id: log.entityId },
                data: {
                  name: stateBefore.name,
                  phone: stateBefore.phone,
                  email: stateBefore.email,
                  addressText: stateBefore.addressText,
                  lat: stateBefore.lat,
                  lng: stateBefore.lng,
                },
              });
            }
            break;
          }

          case "Employee": {
            if (!stateBefore) {
              await tx.employee.updateMany({
                where: { id: log.entityId },
                data: { status: "Inactive" },
              });
            } else if (!stateAfter) {
              await tx.employee.create({
                data: {
                  id: stateBefore.id || log.entityId,
                  name: stateBefore.name,
                  phone: stateBefore.phone,
                  role: stateBefore.role,
                  department: stateBefore.department || "Operations",
                  status: stateBefore.status || "Active",
                },
              });
            } else {
              await tx.employee.update({
                where: { id: log.entityId },
                data: {
                  name: stateBefore.name,
                  phone: stateBefore.phone,
                  role: stateBefore.role,
                  department: stateBefore.department,
                  status: stateBefore.status,
                },
              });
            }
            break;
          }

          case "Product": {
            if (!stateBefore) {
              await tx.product.deleteMany({
                where: { id: log.entityId },
              });
            } else if (!stateAfter) {
              await tx.product.create({
                data: {
                  id: stateBefore.id || log.entityId,
                  name: stateBefore.name,
                  sku: stateBefore.sku,
                  unit: stateBefore.unit || "pcs",
                  stockQuantity: stateBefore.stockQuantity ?? 0,
                  unitPrice: stateBefore.unitPrice ?? 0,
                  costPrice: stateBefore.costPrice ?? 0,
                },
              });
            } else {
              await tx.product.update({
                where: { id: log.entityId },
                data: {
                  name: stateBefore.name,
                  sku: stateBefore.sku,
                  unit: stateBefore.unit,
                  stockQuantity: stateBefore.stockQuantity,
                  unitPrice: stateBefore.unitPrice,
                  costPrice: stateBefore.costPrice,
                },
              });
            }
            break;
          }

          case "InventoryRequest": {
            const curReq = await tx.inventoryRequest.findUnique({ where: { id: log.entityId } });
            if (curReq && curReq.status === "issued" && stateBefore?.status !== "issued") {
              const matchedProd = await tx.product.findFirst({
                where: { name: { contains: curReq.item.split(" ")[0] } },
              });
              if (matchedProd) {
                await tx.product.update({
                  where: { id: matchedProd.id },
                  data: { stockQuantity: { increment: curReq.qtyRequested } },
                });
              }
            }
            if (stateBefore) {
              await tx.inventoryRequest.update({
                where: { id: log.entityId },
                data: { status: stateBefore.status || "pending" },
              });
            }
            break;
          }

          case "Discount": {
            if (stateBefore) {
              await tx.job.update({
                where: { id: log.entityId },
                data: {
                  discountAmount: stateBefore.discountAmount || 0,
                  discountReason: stateBefore.discountReason || null,
                },
              });
            }
            break;
          }

          case "Expense": {
            if (stateBefore) {
              await tx.jobExpenseClaim.update({
                where: { id: log.entityId },
                data: {
                  status: stateBefore.status || "pending",
                  amount: stateBefore.amount,
                },
              });
            }
            break;
          }

          case "JournalEntry": {
            // Proper reversal: equal-and-opposite entry linked to the original, original marked reversed
            // (so it cannot be undone twice and reports net it out correctly).
            const je = await tx.journalEntry.findUnique({ where: { id: log.entityId } });
            if (je) {
              await AccountsPostingService.reverseEntry({
                journalEntryId: je.id,
                reversedBy: rolledBackBy || "System",
                reason: `Audit rollback${reason ? `: ${reason}` : ""}`,
                tx,
              });
            }
            break;
          }

          case "FeedbackCall": {
            if (stateBefore) {
              await tx.feedbackCall.update({
                where: { id: log.entityId },
                data: {
                  outcome: stateBefore.outcome,
                  remarks: stateBefore.remarks,
                  followUpDate: stateBefore.followUpDate ? new Date(stateBefore.followUpDate) : null,
                },
              });
            }
            break;
          }

          default:
            throw new Error(`Unsupported rollback entity type: ${log.entityType}`);
        }

        // Record audit activity log for this rollback
        await tx.activityLog.create({
          data: {
            actorName: rolledBackBy || "System",
            actorRole: "admin",
            category: "DATA_MUTATION",
            action: `ROLLED BACK: ${log.entityType} ${log.entityNumber ? "#" + log.entityNumber : ""} (${log.action})`,
            target: `${log.entityType}:${log.entityId}`,
            metadata: JSON.stringify({ rollbackLogId, reason, stateRestored: stateBefore }),
            ipAddress: "127.0.0.1 (Local Session)",
          },
        });

        return tx.rollbackLog.findUniqueOrThrow({ where: { id: rollbackLogId } });
      },
      { maxWait: 10000, timeout: 30000 }
    );
  }
}
