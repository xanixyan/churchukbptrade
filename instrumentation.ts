/**
 * Next.js Instrumentation
 *
 * This file runs once when the server starts.
 * Used for running database migrations and other startup tasks.
 *
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on server-side (not during build)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[Startup] Server initializing...");

    try {
      // Run database migrations
      const { runMigrations } = await import("./lib/migrations");
      await runMigrations();

      console.log("[Startup] Server initialization complete");
    } catch (error) {
      console.error("[Startup] Error during initialization:", error);
      // Don't throw - let the server continue even if migrations fail
      // Lazy backfill on login will handle any missed sellers
    }
  }
}
