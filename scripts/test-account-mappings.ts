import { prisma } from "../src/lib/prisma";
import { AccountMappingService, AccountMappingError } from "../src/lib/services/AccountMappingService";
import { AccountsPostingService } from "../src/lib/services/AccountsPostingService";

async function testAccountMappings() {
  console.log("==================================================");
  console.log("TESTING ACCOUNT MAPPING ENGINE & RESOLUTION RIGOR");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // TEST 1: Completeness check
  try {
    const completeness = await AccountMappingService.getCompleteness("DEFAULT");
    assert(
      completeness.isComplete && completeness.percentage === 100,
      `Mapping Completeness is 100% (${completeness.configured}/${completeness.total} configured)`
    );
  } catch (err: any) {
    assert(false, `Completeness check failed: ${err.message}`);
  }

  // TEST 2: All 24 core transaction types resolve to active accounts
  try {
    const mappings = await AccountMappingService.getAllMappings("DEFAULT");
    let allValid = true;
    for (const m of mappings) {
      const acc = await AccountMappingService.resolveAccount({
        transactionType: m.transactionType,
      });
      if (!acc || !acc.isActive || !acc.code) {
        allValid = false;
        break;
      }
    }
    assert(allValid, "All 24 core transaction types resolve to active accounts");
  } catch (err: any) {
    assert(false, `Mapping resolution test failed: ${err.message}`);
  }

  // TEST 3: Unmapped transaction type throws AccountMappingError
  try {
    await AccountMappingService.resolveAccount({
      transactionType: "non_existent_unmapped_transaction_xyz",
    });
    assert(false, "Unmapped transaction type should have thrown AccountMappingError");
  } catch (err: any) {
    assert(
      err instanceof AccountMappingError && err.message.includes("Unmapped transaction type"),
      "Unmapped transaction type throws explicit AccountMappingError (no silent default)"
    );
  }

  // TEST 4: AccountsPostingService.getAccountByCode() does NOT auto-insert missing codes
  try {
    await AccountsPostingService.getAccountByCode("9999_DUMMY_CODE");
    assert(false, "getAccountByCode should throw for non-existent account code");
  } catch (err: any) {
    assert(
      err.message.includes("not found in Chart of Accounts"),
      "getAccountByCode() rejects missing code without auto-inserting (fallbackMap successfully removed)"
    );
  }

  // TEST 5: Category-scoped mapping overrides general mapping when provided
  try {
    // Temporarily create a scoped mapping for repair jobs to test scoping
    const revAcc = await prisma.account.findUnique({ where: { code: "4000" } });
    if (revAcc) {
      await prisma.accountMapping.create({
        data: {
          companyId: "DEFAULT",
          transactionType: "job_revenue_sales",
          categoryScope: "special_contract",
          accountId: revAcc.id,
          updatedBy: "Test Runner",
        },
      });

      const resolvedScoped = await AccountMappingService.resolveAccount({
        transactionType: "job_revenue_sales",
        categoryScope: "special_contract",
      });

      assert(
        resolvedScoped.id === revAcc.id,
        "Category-scoped mapping correctly resolves fine-grained override"
      );

      // Clean up scoped mapping
      await prisma.accountMapping.deleteMany({
        where: {
          companyId: "DEFAULT",
          transactionType: "job_revenue_sales",
          categoryScope: "special_contract",
        },
      });
    }
  } catch (err: any) {
    assert(false, `Category-scoped mapping test failed: ${err.message}`);
  }

  // TEST 6: Deactivated account throws AccountMappingError
  try {
    // Create a temporary inactive account and map it
    const testInactive = await prisma.account.create({
      data: {
        code: "9998_INACTIVE",
        name: "Inactive Test Account",
        type: "expense",
        isActive: false,
        level: 4,
        companyId: "DEFAULT",
      },
    });

    await prisma.accountMapping.create({
      data: {
        companyId: "DEFAULT",
        transactionType: "test_inactive_type",
        accountId: testInactive.id,
        updatedBy: "Test Runner",
      },
    });

    let threwInactive = false;
    try {
      await AccountMappingService.resolveAccount({
        transactionType: "test_inactive_type",
      });
    } catch (e: any) {
      threwInactive = e instanceof AccountMappingError && e.message.includes("is deactivated");
    }

    assert(threwInactive, "resolveAccount() rejects deactivated accounts with clear error");

    // Clean up
    await prisma.accountMapping.deleteMany({ where: { transactionType: "test_inactive_type" } });
    await prisma.account.delete({ where: { id: testInactive.id } });
  } catch (err: any) {
    assert(false, `Deactivated account test failed: ${err.message}`);
  }

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

testAccountMappings()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
