const fs = require("fs");
const path = "src/lib/services/ProcurementService.ts";
let s = fs.readFileSync(path, "utf8");
// Normalize to LF for patching
const hadCRLF = s.includes("\r\n");
s = s.replace(/\r\n/g, "\n");

// 1) RFQ award → draft PO
const awardNeedle = `        status: "approved",
        approvedBy: actorName,
        approvedAt: now,
        totalAmount,`;
const awardRepl = `        status: "draft",
        approvedBy: null,
        approvedAt: null,
        totalAmount,`;
if (!s.includes(awardNeedle)) {
  // maybe already patched
  if (!s.includes('status: "draft",\n        approvedBy: null')) {
    throw new Error("award RFQ status block not found");
  }
  console.log("award already draft");
} else {
  s = s.replace(awardNeedle, awardRepl);
  console.log("award -> draft");
}

// 2) convertPrsToPo
const convertNeedle = `    // Mark ALL source PRs as converted_to_po
    await prisma.purchaseRequisition.updateMany({
      where: { id: { in: params.prIds } },
      data: { status: "converted_to_po" },
    });

    return createdPo;
  }`;

const convertRepl = `    // Update convertedQuantity per PR line, then set partially_converted vs converted_to_po
    for (const poItem of poItems) {
      if (!poItem.prItemId) continue;
      const qty = Number(poItem.quantity) || 0;
      if (qty <= 0) continue;
      await prisma.purchaseRequisitionItem.update({
        where: { id: poItem.prItemId },
        data: { convertedQuantity: { increment: qty } },
      });
    }

    for (const pr of prs) {
      const freshItems = await prisma.purchaseRequisitionItem.findMany({
        where: { prId: pr.id },
      });
      const allConverted = freshItems.every(
        (it) => (it.convertedQuantity || 0) >= it.quantity - 1e-9
      );
      const anyConverted = freshItems.some((it) => (it.convertedQuantity || 0) > 0);
      const nextStatus = allConverted
        ? "converted_to_po"
        : anyConverted
          ? "partially_converted"
          : pr.status;
      await prisma.purchaseRequisition.update({
        where: { id: pr.id },
        data: { status: nextStatus },
      });
    }

    return createdPo;
  }`;

if (!s.includes(convertNeedle)) throw new Error("convert needle missing: " + JSON.stringify(s.slice(s.indexOf("Mark ALL"), s.indexOf("Mark ALL")+200)));
s = s.replace(convertNeedle, convertRepl);
console.log("convert partial status OK");

// 3) GRN over-receive
const grnNeedle = `      const qtyAcc = quality === "Accepted" ? (item.quantityAccepted ?? qtyRec) : 0;
      const qtyRej = qtyRec - qtyAcc;

      totalAcceptedValue += qtyAcc * unitCost;`;
const grnRepl = `      const qtyAcc = quality === "Accepted" ? (item.quantityAccepted ?? qtyRec) : 0;
      const qtyRej = qtyRec - qtyAcc;

      // Hard gate: block over-receive vs remaining PO qty
      if (poItem) {
        const alreadyReceived = Number(poItem.quantityReceived) || 0;
        const ordered = Number(poItem.quantity) || 0;
        const remaining = Math.max(0, ordered - alreadyReceived);
        if (qtyRec > remaining + 1e-9) {
          throw new Error(
            \`Cannot over-receive for PO line "\${poItem.description || poItem.itemCode || poItem.id}": received \${qtyRec} but only \${remaining} remaining of \${ordered} ordered\`
          );
        }
      }

      totalAcceptedValue += qtyAcc * unitCost;`;
if (!s.includes(grnNeedle)) throw new Error("grn needle missing");
s = s.replace(grnNeedle, grnRepl);
console.log("grn over-receive OK");

// 3b) GRN GL fail
const grnGl = `      } catch (err: any) {
        console.error("Failed to post GRN accounting voucher:", err.message);
      }`;
const grnGlRepl = `      } catch (err: any) {
        // Fail whole operation — no silent success when GL fails
        throw new Error(
          \`GRN GL posting failed — operation aborted: \${err.message || err}\`
        );
      }`;
if (!s.includes(grnGl)) throw new Error("grn GL catch missing");
s = s.replace(grnGl, grnGlRepl);
console.log("grn GL throw OK");

// 4) invoice approve GL
const invGl = `    } catch (err: any) {
      console.error("Failed to post 3-Way Match accounting entry:", err.message);
    }`;
const invGlRepl = `    } catch (err: any) {
      throw new Error(
        \`Invoice approval aborted: GL posting failed (\${err.message || err}). No AP/status update applied.\`
      );
    }`;
if (!s.includes(invGl)) throw new Error("invoice GL catch missing");
s = s.replace(invGl, invGlRepl);
console.log("invoice GL throw OK");

// 5) payment gate
const payNeedle = `    if (!invoice) throw new Error("Supplier invoice not found");

    const count = await prisma.supplierPayment.count();`;
const payRepl = `    if (!invoice) throw new Error("Supplier invoice not found");

    // Hard gate: payment only when invoice is approved_for_payment
    if (invoice.matchStatus !== "approved_for_payment") {
      throw new Error(
        \`Payment rejected: invoice matchStatus must be 'approved_for_payment' (current: '\${invoice.matchStatus}')\`
      );
    }

    const count = await prisma.supplierPayment.count();`;
if (!s.includes(payNeedle)) throw new Error("pay needle missing");
s = s.replace(payNeedle, payRepl);
console.log("payment gate OK");

const payGl = `    } catch (err: any) {
      console.error("Failed to post vendor payment accounting voucher:", err.message);
    }`;
const payGlRepl = `    } catch (err: any) {
      throw new Error(
        \`Payment aborted: GL posting failed (\${err.message || err}). No payment record created.\`
      );
    }`;
if (!s.includes(payGl)) throw new Error("pay GL catch missing");
s = s.replace(payGl, payGlRepl);
console.log("pay GL throw OK");

// Improve GRN atomicity: wrap stock+grn create, and if GL fails reverse via throw
// before GRN was already created. Restructure: validate first, create GRN+stock in
// transaction, then post GL; on GL fail delete GRN and reverse stock.
// For P0: also move GL posting earlier by restructuring createGoodsReceipt.

const createGrnMarker = `  static async createGoodsReceipt(data: CreateGrnInput) {`;
if (!s.includes("// P0-ATOMIC-GRN")) {
  // After GRN create + GL throw, add compensating rollback on GL failure
  // Replace the GL catch block we just set to also attempt rollback
  const weakGl = `      } catch (err: any) {
        // Fail whole operation — no silent success when GL fails
        throw new Error(
          \`GRN GL posting failed — operation aborted: \${err.message || err}\`
        );
      }`;
  const strongGl = `      } catch (err: any) {
        // Rollback GRN + stock increments so we never report success without GL
        try {
          for (const gi of grnItemsData) {
            if (gi.poItemId && gi.quantityAccepted > 0) {
              await prisma.purchaseOrderItem.update({
                where: { id: gi.poItemId },
                data: { quantityReceived: { decrement: gi.quantityAccepted } },
              });
            }
            if (gi.productId && gi.quantityAccepted > 0) {
              await prisma.product.update({
                where: { id: gi.productId },
                data: { stockQuantity: { decrement: gi.quantityAccepted } },
              });
              await prisma.stockLedger.deleteMany({
                where: { refType: "grn", refId: grnNumber },
              });
            }
          }
          await prisma.goodsReceiptItem.deleteMany({ where: { grnId: grn.id } });
          await prisma.goodsReceipt.delete({ where: { id: grn.id } });
        } catch (rollbackErr: any) {
          throw new Error(
            \`GRN GL posting failed (\${err.message || err}) and rollback also failed (\${rollbackErr.message || rollbackErr})\`
          );
        }
        throw new Error(
          \`GRN GL posting failed — operation rolled back: \${err.message || err}\`
        );
      }`;
  if (!s.includes(weakGl)) throw new Error("weak gl block missing for strengthen");
  s = s.replace(weakGl, strongGl);
  console.log("GRN rollback on GL fail OK");
}

if (hadCRLF) s = s.replace(/\n/g, "\r\n");
fs.writeFileSync(path, s);
console.log("DONE", s.length);
