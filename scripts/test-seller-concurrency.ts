/**
 * Concurrency Test for Seller Inventory Updates
 *
 * This script tests that concurrent inventory updates to the same seller
 * do not result in lost updates due to race conditions.
 *
 * Test scenario:
 * 1. Create a test seller with inventory quantity = 0
 * 2. Launch N concurrent atomic increment operations (+1 each)
 * 3. Verify final quantity = N (no lost updates)
 *
 * Run with: npx tsx scripts/test-seller-concurrency.ts
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

// Import the functions we're testing
import {
  adjustSellerInventoryItem,
  getSellerBlueprintQuantity,
} from "../lib/sellers";
import { safeWriteJson } from "../lib/safe-file";
import { SellerWithInventory } from "../lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const SELLERS_DIR = path.join(DATA_DIR, "sellers");

// Test configuration
const NUM_CONCURRENT_UPDATES = 50;
const TEST_BLUEPRINT_ID = "test-blueprint-001";
const TEST_SELLER_ID = `test-seller-${crypto.randomBytes(4).toString("hex")}`;

async function ensureDirectories(): Promise<void> {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(SELLERS_DIR)) {
    fs.mkdirSync(SELLERS_DIR, { recursive: true });
  }
}

async function createTestSeller(): Promise<void> {
  const now = new Date().toISOString();
  const seller: SellerWithInventory = {
    id: TEST_SELLER_ID,
    discordId: `test-discord-${TEST_SELLER_ID}`,
    passwordHash: "",
    status: "active",
    createdAt: now,
    updatedAt: now,
    inventory: [{ blueprintId: TEST_BLUEPRINT_ID, quantity: 0 }],
  };

  const filePath = path.join(SELLERS_DIR, `${TEST_SELLER_ID}.json`);
  safeWriteJson(filePath, seller);
  console.log(`Created test seller: ${TEST_SELLER_ID}`);
}

async function cleanupTestSeller(): Promise<void> {
  const filePath = path.join(SELLERS_DIR, `${TEST_SELLER_ID}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`Cleaned up test seller: ${TEST_SELLER_ID}`);
  }
}

async function runConcurrentAtomicIncrements(): Promise<number> {
  // Each update atomically increments quantity by 1
  // With proper locking, all increments should be applied
  const updatePromises: Promise<number | null>[] = [];

  for (let i = 0; i < NUM_CONCURRENT_UPDATES; i++) {
    // Use atomic increment - the read-modify-write happens inside the lock
    const updatePromise = adjustSellerInventoryItem(
      TEST_SELLER_ID,
      TEST_BLUEPRINT_ID,
      1 // Increment by 1
    );
    updatePromises.push(updatePromise);
  }

  // Run all updates concurrently
  const results = await Promise.all(updatePromises);

  // Count successful updates (non-null results)
  return results.filter((r) => r !== null).length;
}

async function runTest(): Promise<void> {
  console.log("=".repeat(60));
  console.log("Seller Inventory Concurrency Test");
  console.log("=".repeat(60));
  console.log(`Test configuration:`);
  console.log(`  - Concurrent atomic increments: ${NUM_CONCURRENT_UPDATES}`);
  console.log(`  - Each operation increments quantity by 1 (inside lock)`);
  console.log(`  - Expected final quantity: ${NUM_CONCURRENT_UPDATES}`);
  console.log("");

  try {
    await ensureDirectories();
    await createTestSeller();

    // Verify initial state
    const initialQty = getSellerBlueprintQuantity(TEST_SELLER_ID, TEST_BLUEPRINT_ID);
    console.log(`Initial quantity: ${initialQty}`);

    // Run concurrent atomic increments
    console.log(`\nRunning ${NUM_CONCURRENT_UPDATES} concurrent atomic increment operations...`);
    const startTime = Date.now();
    const successCount = await runConcurrentAtomicIncrements();
    const elapsed = Date.now() - startTime;

    // Verify final state
    const finalQty = getSellerBlueprintQuantity(TEST_SELLER_ID, TEST_BLUEPRINT_ID);
    console.log(`\nResults:`);
    console.log(`  - Successful operations: ${successCount}`);
    console.log(`  - Final quantity: ${finalQty}`);
    console.log(`  - Expected quantity: ${NUM_CONCURRENT_UPDATES}`);
    console.log(`  - Time elapsed: ${elapsed}ms`);
    console.log("");

    // Determine pass/fail
    if (finalQty === NUM_CONCURRENT_UPDATES) {
      console.log("✅ PASS: No lost updates detected!");
      console.log("   File locking is working correctly.");
      console.log("   All concurrent increments were properly serialized.");
    } else {
      console.log("❌ FAIL: Lost updates detected!");
      console.log(`   Expected ${NUM_CONCURRENT_UPDATES}, got ${finalQty}`);
      console.log(`   Lost ${NUM_CONCURRENT_UPDATES - finalQty} updates`);
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("❌ FAIL: Test error:", error);
    process.exitCode = 1;
  } finally {
    await cleanupTestSeller();
  }

  console.log("=".repeat(60));
}

// Run the test
runTest();
