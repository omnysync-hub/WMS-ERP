import { prisma } from "@/lib/prisma";
import { AccountsPostingService } from "./AccountsPostingService";

export interface CreateFixedAssetParams {
  name: string;
  category: string;
  hrmAssetId?: string;
  acquisitionDate: Date;
  acquisitionCost: number;
  salvageValue?: number;
  usefulLifeMonths: number;
  depreciationMethod?: "straight_line";
  assetAccountCode?: string;
  accumDeprAccountCode?: string;
  deprExpenseAccountCode?: string;
}

export class FixedAssetService {
  /**
   * Register a new fixed asset.
   */
  static async createFixedAsset(params: CreateFixedAssetParams) {
    const count = await prisma.fixedAsset.count();
    const assetNumber = `FA-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const salvage = params.salvageValue || 0;
    const cost = params.acquisitionCost;

    return await prisma.fixedAsset.create({
      data: {
        assetNumber,
        name: params.name,
        category: params.category,
        hrmAssetId: params.hrmAssetId || null,
        acquisitionDate: params.acquisitionDate,
        acquisitionCost: cost,
        salvageValue: salvage,
        usefulLifeMonths: params.usefulLifeMonths || 60,
        depreciationMethod: params.depreciationMethod || "straight_line",
        assetAccountCode: params.assetAccountCode || "1500",
        accumDeprAccountCode: params.accumDeprAccountCode || "1590",
        deprExpenseAccountCode: params.deprExpenseAccountCode || "6350",
        accumulatedDepreciation: 0,
        bookValue: cost,
        status: "active",
      },
    });
  }

  /**
   * Run Monthly Fixed Asset Depreciation Routine (SAP-FICO / GAAP Standard).
   * Straight-Line Formula: Monthly = (Acquisition Cost - Salvage Value) / Useful Life Months.
   * Idempotent: Will not double-post if run twice for the same period.
   */
  static async runMonthlyDepreciation(period: string, postedBy: string) {
    // 1. Fetch all active assets that haven't been depreciated for this period yet
    const activeAssets = await prisma.fixedAsset.findMany({
      where: {
        status: "active",
        bookValue: { gt: 0 },
      },
    });

    const eligibleAssets = activeAssets.filter((a) => {
      if (a.lastDepreciationPeriod === period) return false;
      if (a.bookValue <= a.salvageValue) return false;
      return true;
    });

    if (eligibleAssets.length === 0) {
      return {
        success: true,
        period,
        processedCount: 0,
        totalDepreciation: 0,
        message: `All assets are already depreciated for period '${period}' or have reached salvage value.`,
      };
    }

    // 2. Calculate depreciation per asset
    let totalDepreciationAmount = 0;
    const assetUpdates = [];

    for (const asset of eligibleAssets) {
      const depreciableBase = Math.max(0, asset.acquisitionCost - asset.salvageValue);
      const standardMonthly = depreciableBase / asset.usefulLifeMonths;

      // Ensure we don't depreciate past salvage value
      const remainingDepreciable = asset.bookValue - asset.salvageValue;
      const actualDepr = Math.round(Math.min(standardMonthly, remainingDepreciable) * 100) / 100;

      if (actualDepr > 0) {
        totalDepreciationAmount += actualDepr;
        const newAccum = Math.round((asset.accumulatedDepreciation + actualDepr) * 100) / 100;
        const newBook = Math.round((asset.acquisitionCost - newAccum) * 100) / 100;
        const isFullyDepreciated = newBook <= asset.salvageValue;

        assetUpdates.push({
          assetId: asset.id,
          actualDepr,
          newAccum,
          newBook,
          isFullyDepreciated,
          assetName: asset.name,
          assetNumber: asset.assetNumber,
        });
      }
    }

    if (totalDepreciationAmount <= 0) {
      return {
        success: true,
        period,
        processedCount: 0,
        totalDepreciation: 0,
        message: "Calculated depreciation is zero.",
      };
    }

    // 3. Post Balanced General Journal Entry
    // Dr 6350 Depreciation Expense / Cr 1590 Accumulated Depreciation
    const deprExpenseAcc = await AccountsPostingService.getAccountByCode("6350");
    const accumDeprAcc = await AccountsPostingService.getAccountByCode("1590");

    const journal = await AccountsPostingService.post({
      date: new Date(),
      memo: `Monthly Fixed Asset Depreciation Run — Period ${period} (${assetUpdates.length} Assets)`,
      refType: "asset_depreciation",
      refId: period,
      postedBy,
      lines: [
        { accountId: deprExpenseAcc.id, debit: Math.round(totalDepreciationAmount * 100) / 100, credit: 0 },
        { accountId: accumDeprAcc.id, debit: 0, credit: Math.round(totalDepreciationAmount * 100) / 100 },
      ],
    });

    // 4. Update assets in database
    for (const u of assetUpdates) {
      await prisma.fixedAsset.update({
        where: { id: u.assetId },
        data: {
          accumulatedDepreciation: u.newAccum,
          bookValue: u.newBook,
          lastDepreciationPeriod: period,
          status: u.isFullyDepreciated ? "fully_depreciated" : "active",
        },
      });
    }

    // 5. Log Financial Audit
    await prisma.financialAuditLog.create({
      data: {
        entity: "FixedAsset",
        entityId: period,
        action: "DEPRECIATE",
        afterValue: JSON.stringify({
          period,
          totalDepreciationAmount,
          assetsCount: assetUpdates.length,
          journalEntryId: journal.id,
        }),
        userName: postedBy,
        userRole: "accountant",
      },
    });

    return {
      success: true,
      period,
      processedCount: assetUpdates.length,
      totalDepreciation: Math.round(totalDepreciationAmount * 100) / 100,
      journalEntryId: journal.id,
      updates: assetUpdates,
    };
  }

  static async listAssets() {
    return await prisma.fixedAsset.findMany({
      orderBy: { acquisitionDate: "desc" },
    });
  }

  static async createAsset(params: any) {
    return await this.createFixedAsset({
      name: params.name,
      category: params.category,
      acquisitionDate: params.inServiceDate || params.acquisitionDate || new Date(),
      acquisitionCost: Number(params.cost) || Number(params.acquisitionCost) || 0,
      salvageValue: Number(params.salvageValue) || 0,
      usefulLifeMonths: Number(params.usefulLifeMonths) || 60,
      assetAccountCode: params.assetAccountCode || "1500",
      accumDeprAccountCode: params.accumDepAccountCode || params.accumDeprAccountCode || "1590",
      deprExpenseAccountCode: params.depExpenseAccountCode || params.deprExpenseAccountCode || "6350",
    });
  }
}
