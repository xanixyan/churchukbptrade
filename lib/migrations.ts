/**
 * Database Migrations
 *
 * Migration scripts to ensure data consistency across schema changes.
 * All migrations are designed to be idempotent (safe to run multiple times).
 */

import fs from "fs";
import path from "path";
import { getAllSellers } from "./sellers";
import { getBuyerByDiscordId, createBuyerProfileForSeller } from "./buyers";

// Track migration state
const DATA_DIR = path.join(process.cwd(), "data");
const MIGRATIONS_FILE = path.join(DATA_DIR, "migrations.json");

interface MigrationState {
  completedMigrations: string[];
  lastRun: string;
}

/**
 * Read migration state from file
 */
function getMigrationState(): MigrationState {
  try {
    if (fs.existsSync(MIGRATIONS_FILE)) {
      const data = fs.readFileSync(MIGRATIONS_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error reading migration state:", error);
  }
  return { completedMigrations: [], lastRun: "" };
}

/**
 * Save migration state to file
 */
function saveMigrationState(state: MigrationState): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(MIGRATIONS_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error("Error saving migration state:", error);
  }
}

/**
 * Mark a migration as completed
 */
function markMigrationComplete(migrationName: string): void {
  const state = getMigrationState();
  if (!state.completedMigrations.includes(migrationName)) {
    state.completedMigrations.push(migrationName);
  }
  state.lastRun = new Date().toISOString();
  saveMigrationState(state);
}

/**
 * Check if a migration has been completed
 */
function isMigrationComplete(migrationName: string): boolean {
  const state = getMigrationState();
  return state.completedMigrations.includes(migrationName);
}

// ============================================
// MIGRATION: Backfill buyer records for existing sellers
// ============================================

const MIGRATION_SELLER_BUYER_BACKFILL = "seller-buyer-backfill-v1";

/**
 * Migration: Create buyer records for all existing sellers
 *
 * This ensures that all sellers can use buyer features with the same credentials.
 * Uses the seller's existing passwordHash - no plaintext password needed.
 *
 * Idempotent: Safe to run multiple times.
 */
export async function migrateSellersToBuyers(): Promise<{
  success: boolean;
  created: number;
  skipped: number;
  errors: string[];
}> {
  const result = {
    success: true,
    created: 0,
    skipped: 0,
    errors: [] as string[],
  };

  console.log("[Migration] Starting seller->buyer backfill...");

  try {
    const sellers = getAllSellers();
    console.log(`[Migration] Found ${sellers.length} sellers to process`);

    for (const seller of sellers) {
      try {
        // Check if buyer already exists for this discord
        const existingBuyer = getBuyerByDiscordId(seller.discordId);

        if (existingBuyer) {
          // Buyer already exists - skip
          result.skipped++;
          continue;
        }

        // Check if seller has a valid password hash
        if (!seller.passwordHash) {
          result.errors.push(`Seller ${seller.discordId} has no passwordHash - skipping`);
          result.skipped++;
          continue;
        }

        // Create buyer profile using seller's password hash
        const buyerResult = await createBuyerProfileForSeller(
          seller.discordId,
          seller.passwordHash
        );

        if (buyerResult.success && buyerResult.buyer) {
          result.created++;
          console.log(`[Migration] Created buyer profile for seller: ${seller.discordId}`);
        } else {
          result.errors.push(`Failed to create buyer for ${seller.discordId}: ${buyerResult.error}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`Error processing seller ${seller.discordId}: ${errorMsg}`);
      }
    }

    console.log(`[Migration] Completed: ${result.created} created, ${result.skipped} skipped`);

    if (result.errors.length > 0) {
      console.warn(`[Migration] Errors encountered:`, result.errors);
      result.success = result.errors.length < sellers.length; // Partial success if some worked
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Migration failed: ${errorMsg}`);
    result.success = false;
    console.error("[Migration] Failed:", error);
  }

  return result;
}

/**
 * Run all pending migrations
 * Called on application startup
 */
export async function runMigrations(): Promise<void> {
  console.log("[Migrations] Checking for pending migrations...");

  // Migration 1: Seller -> Buyer backfill
  if (!isMigrationComplete(MIGRATION_SELLER_BUYER_BACKFILL)) {
    console.log("[Migrations] Running seller->buyer backfill migration...");
    const result = await migrateSellersToBuyers();

    if (result.success) {
      markMigrationComplete(MIGRATION_SELLER_BUYER_BACKFILL);
      console.log("[Migrations] Seller->buyer backfill completed successfully");
    } else {
      console.error("[Migrations] Seller->buyer backfill had errors - will retry on next startup");
    }
  } else {
    console.log("[Migrations] Seller->buyer backfill already completed - skipping");
  }

  console.log("[Migrations] All migrations checked");
}

/**
 * Force re-run all migrations (for debugging/admin purposes)
 */
export async function forceRunAllMigrations(): Promise<void> {
  console.log("[Migrations] Force running all migrations...");

  // Clear migration state
  saveMigrationState({ completedMigrations: [], lastRun: "" });

  // Run all migrations
  await runMigrations();
}

/**
 * Ensure buyer exists for a seller (lazy backfill on login)
 * This is a safety net for any sellers that might have been missed
 */
export async function ensureBuyerForSeller(
  discordId: string,
  passwordHash: string
): Promise<{ buyerId?: string; created: boolean }> {
  // Check if buyer already exists
  const existingBuyer = getBuyerByDiscordId(discordId);

  if (existingBuyer) {
    return { buyerId: existingBuyer.id, created: false };
  }

  // Create buyer profile
  const result = await createBuyerProfileForSeller(discordId, passwordHash);

  if (result.success && result.buyer) {
    console.log(`[LazyBackfill] Created buyer profile for seller: ${discordId}`);
    return { buyerId: result.buyer.id, created: true };
  }

  console.error(`[LazyBackfill] Failed to create buyer for ${discordId}: ${result.error}`);
  return { created: false };
}
