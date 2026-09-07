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
  entityType: "Job" | "InventoryRequest" | "StockReturn" | "Discount" | "Expense" | "JournalEntry";
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
          stateBefore: JSON.stringify(params.stateBefore),
          stateAfter: JSON.stringify(params.stateAfter),
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
   * Execute an atomic rollback reverting an entity back to its previous state.
   */
  static async executeRollback(rollbackLogId: string, rolledBackBy: string, reason?: string) {
    const log = await prisma.rollbackLog.findUnique({
      where: { id: rollbackLogId },
    });

    if (!log) throw new Error("Rollback record not found");
    if (log.status === "ROLLED_BACK") throw new Error("This action has already been rolled back");
    if (!log.canRollback) throw new Error("This action is marked as non-reversible");

    const stateBefore = JSON.parse(log.stateBefore);

    // Revert entity based on entityType
    switch (log.entityType) {
      case "Job": {
        const updateData: any = {};
        if (stateBefore.status !== undefined) updateData.status = stateBefore.status;
        if (stateBefore.assignedTechnicianId !== undefined) updateData.assignedTechnicianId = stateBefore.assignedTechnicianId;
        if (stateBefore.discountAmount !== undefined) updateData.discountAmount = stateBefore.discountAmount;
        if (stateBefore.discountReason !== undefined) updateData.discountReason = stateBefore.discountReason;
        if (stateBefore.finalizedAt !== undefined) updateData.finalizedAt = stateBefore.finalizedAt ? new Date(stateBefore.finalizedAt) : null;
        if (stateBefore.qualityFlag !== undefined) updateData.qualityFlag = stateBefore.qualityFlag;

        await prisma.job.update({
          where: { id: log.entityId },
          data: updateData,
        });

        // If items had actual quantities changed, restore them
        if (stateBefore.items && Array.isArray(stateBefore.items)) {
          for (const it of stateBefore.items) {
            await prisma.jobItem.update({
              where: { id: it.id },
              data: {
                quantityActual: it.quantityActual ?? null,
                unitRate: it.unitRate,
                description: it.description,
              },
            });
          }
        }
        break;
      }

      case "InventoryRequest": {
        const curReq = await prisma.inventoryRequest.findUnique({ where: { id: log.entityId } });
        if (curReq && curReq.status === "issued" && stateBefore.status === "pending") {
          // If stock was consumed, re-credit to warehouse
          const matchedProd = await prisma.product.findFirst({
            where: { name: { contains: curReq.item.split(" ")[0] } },
          });
          if (matchedProd) {
            await prisma.product.update({
              where: { id: matchedProd.id },
              data: { stockQuantity: { increment: curReq.qtyRequested } },
            });
          }
        }
        await prisma.inventoryRequest.update({
          where: { id: log.entityId },
          data: { status: stateBefore.status || "pending" },
        });
        break;
      }

      case "Discount": {
        await prisma.job.update({
          where: { id: log.entityId },
          data: {
            discountAmount: stateBefore.discountAmount || 0,
            discountReason: stateBefore.discountReason || null,
          },
        });
        break;
      }

      case "Expense": {
        await prisma.jobExpenseClaim.update({
          where: { id: log.entityId },
          data: {
            status: stateBefore.status || "pending",
          },
        });
        break;
      }

      case "JournalEntry": {
        // Revert Journal Entry: post exact inverse double entry
        const je = await prisma.journalEntry.findUnique({
          where: { id: log.entityId },
          include: { lines: true },
        });
        if (je) {
          const inverseLines = je.lines.map((l) => ({
            accountId: l.accountId,
            debit: l.credit,
            credit: l.debit,
          }));
          await AccountsPostingService.post({
            memo: `ROLLBACK REVERSAL: ${je.memo}`,
            refType: `rollback_${je.refType}`,
            refId: je.id,
            lines: inverseLines,
          });
        }
        break;
      }

      default:
        throw new Error(`Unsupported rollback entity type: ${log.entityType}`);
    }

    // Mark the rollback log as ROLLED_BACK
    const updated = await prisma.rollbackLog.update({
      where: { id: rollbackLogId },
      data: {
        status: "ROLLED_BACK",
        rolledBackAt: new Date(),
        rolledBackBy,
        reason: reason || "Rolled back by administrator",
      },
    });

    // Log this rollback in ActivityLog
    await AuditService.logActivity({
      actorName: rolledBackBy,
      actorRole: "admin",
      category: "DATA_MUTATION",
      action: `ROLLED BACK: ${log.entityType} ${log.entityNumber ? '#' + log.entityNumber : ''} (${log.action})`,
      target: `${log.entityType}:${log.entityId}`,
      metadata: { rollbackLogId, reason },
    });

    return updated;
  }
}
