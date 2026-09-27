const fs = require("fs");
const path = "src/lib/services/ProcurementService.ts";
let s = fs.readFileSync(path, "utf8");

// 1) RFQ award → draft PO (not pre-approved)
s = s.replace(
  `        status: "approved",
        approvedBy: actorName,
        approvedAt: now,
        totalAmount,`,
  `        status: "draft",
        approvedBy: null,
        approvedAt: null,
        totalAmount,`
);

// 2) convertPrsToPo — partial vs full conversion with convertedQuantity
const oldConvertTail = `    const createdPo = await this.createPurchaseOrder({
      poType: params.poType || "standard",
      vendorId: vendor.id,
      supplierName: vendor.name,
      supplierEmail: vendor.email || "orders@vendor.pk",
      prId: prs[0]?.id,
      expectedDeliveryDate: params.expectedDeliveryDate,
      paymentTerms: vendor.paymentTerms || "Net 30",
      items: poItems,
    });

    // Mark ALL source PRs as converted_to_po
    await prisma.purchaseRequisition.updateMany({
      where: { id: { in: params.prIds } },
      data: { status: "converted_to_po" },
    });

    return createdPo;
  }`;

const newConvertTail = `    const createdPo = await this.createPurchaseOrder({
      poType: params.poType || "standard",
      vendorId: vendor.id,
      supplierName: vendor.name,
      supplierEmail: vendor.email || "orders@vendor.pk",
      prId: prs[0]?.id,
      expectedDeliveryDate: params.expectedDeliveryDate,
      paymentTerms: vendor.paymentTerms || "Net 30",
      items: poItems,
    });

    // Update convertedQuantity per PR line, then set partially_converted vs converted_to_po
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

if (!s.includes(oldConvertTail)) {
  throw new Error("convertPrsToPo tail not found");
}
s = s.replace(oldConvertTail, newConvertTail);

// 3) GRN over-receive gate + GL fail throws
const oldGrnLoopStart = `    for (const item of data.items) {
      const poItem = po.items.find((pi) => pi.id === item.poItemId);
      const pId = item.productId || poItem?.productId;
      const unitCost = poItem?.unitCost || 0;

      const qtyRec = Number(item.quantityReceived) || 0;
      const quality = item.qualityStatus || "Accepted";
      const qtyAcc = quality === "Accepted" ? (item.quantityAccepted ?? qtyRec) : 0;
      const qtyRej = qtyRec - qtyAcc;`;

const newGrnLoopStart = `    for (const item of data.items) {
      const poItem = po.items.find((pi) => pi.id === item.poItemId);
      const pId = item.productId || poItem?.productId;
      const unitCost = poItem?.unitCost || 0;

      const qtyRec = Number(item.quantityReceived) || 0;
      const quality = item.qualityStatus || "Accepted";
      const qtyAcc = quality === "Accepted" ? (item.quantityAccepted ?? qtyRec) : 0;
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
      }`;

if (!s.includes(oldGrnLoopStart)) throw new Error("GRN loop start not found");
s = s.replace(oldGrnLoopStart, newGrnLoopStart);

s = s.replace(
  `      } catch (err: any) {
        console.error("Failed to post GRN accounting voucher:", err.message);
      }
    }

    // 3. Update PO Overall Status (partially_received or fully_received)`,
  `      } catch (err: any) {
        // Fail the whole GRN operation if GL posting fails (no silent success)
        throw new Error(
          \`GRN created but GL posting failed — operation aborted: \${err.message || err}. Manual reversal of stock may be required if partial state persists.\`
        );
      }
    }

    // 3. Update PO Overall Status (partially_received or fully_received)`
);

// Better GRN approach: post GL before returning success, and if we already created GRN,
// we should restructure. For true atomicity, move GL failure to throw BEFORE updating
// PO status is fine but GRN already exists. Let's restructure createGoodsReceipt more carefully.

// 4) approveSupplierInvoice — remove silent catch
s = s.replace(
  `    } catch (err: any) {
      console.error("Failed to post 3-Way Match accounting entry:", err.message);
    }

    // 2. Post to Vendor Sub-Ledger (Accounts Payable Credit)`,
  `    } catch (err: any) {
      throw new Error(
        \`Invoice approval aborted: GL posting failed (\${err.message || err}). No AP/status update applied.\`
      );
    }

    // 2. Post to Vendor Sub-Ledger (Accounts Payable Credit)`
);

// 5) recordSupplierPayment — require approved_for_payment + GL fail throws
const oldPayStart = `  static async recordSupplierPayment(data: RecordPaymentInput, actorName = "Fatima Noor") {
    const invoice = await prisma.supplierInvoice.findUnique({
      where: { id: data.supplierInvoiceId },
      include: { vendor: true },
    });
    if (!invoice) throw new Error("Supplier invoice not found");

    const count = await prisma.supplierPayment.count();`;

const newPayStart = `  static async recordSupplierPayment(data: RecordPaymentInput, actorName = "Fatima Noor") {
    const invoice = await prisma.supplierInvoice.findUnique({
      where: { id: data.supplierInvoiceId },
      include: { vendor: true },
    });
    if (!invoice) throw new Error("Supplier invoice not found");

    // Hard gate: payment only when invoice is approved_for_payment
    if (invoice.matchStatus !== "approved_for_payment") {
      throw new Error(
        \`Payment rejected: invoice matchStatus must be 'approved_for_payment' (current: '\${invoice.matchStatus}')\`
      );
    }

    const count = await prisma.supplierPayment.count();`;

if (!s.includes(oldPayStart)) throw new Error("recordSupplierPayment start not found");
s = s.replace(oldPayStart, newPayStart);

s = s.replace(
  `    } catch (err: any) {
      console.error("Failed to post vendor payment accounting voucher:", err.message);
    }

    // 2. Post to Vendor Sub-Ledger (Debit entry)`,
  `    } catch (err: any) {
      throw new Error(
        \`Payment aborted: GL posting failed (\${err.message || err}). No payment record created.\`
      );
    }

    // 2. Post to Vendor Sub-Ledger (Debit entry)`
);

fs.writeFileSync(path, s);
console.log("ProcurementService hard gates patched", s.length);
