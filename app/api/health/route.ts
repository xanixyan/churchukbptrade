import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * GET /api/health - Health check endpoint
 * Returns status of the application and its dependencies
 */
export async function GET() {
  const checks: Record<string, { status: "ok" | "error"; message?: string }> = {};
  let overallStatus: "ok" | "degraded" | "error" = "ok";

  // Check 1: App is running (if we got here, it's running)
  checks.app = { status: "ok" };

  // Check 2: Blueprints directory
  try {
    const blueprintsDir = path.join(process.cwd(), "content", "blueprints");
    if (fs.existsSync(blueprintsDir)) {
      const files = fs.readdirSync(blueprintsDir).filter((f) => f.endsWith(".json"));
      checks.blueprints = {
        status: "ok",
        message: `${files.length} blueprint files found`,
      };
    } else {
      checks.blueprints = {
        status: "error",
        message: "Blueprints directory not found",
      };
      overallStatus = "degraded";
    }
  } catch (error) {
    checks.blueprints = {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    };
    overallStatus = "degraded";
  }

  // Check 3: Data directory (sellers)
  try {
    const dataDir = path.join(process.cwd(), "data");
    const sellersDir = path.join(dataDir, "sellers");

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(sellersDir)) {
      fs.mkdirSync(sellersDir, { recursive: true });
    }

    const sellerFiles = fs.readdirSync(sellersDir).filter((f) => f.endsWith(".json"));
    checks.sellers = {
      status: "ok",
      message: `${sellerFiles.length} seller files found`,
    };
  } catch (error) {
    checks.sellers = {
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    };
    overallStatus = "degraded";
  }

  // Check 4: Environment variables
  const requiredEnvVars = ["ADMIN_PASSWORD"];
  const missingEnvVars = requiredEnvVars.filter((v) => !process.env[v]);

  if (missingEnvVars.length === 0) {
    checks.env = { status: "ok" };
  } else {
    checks.env = {
      status: "error",
      message: `Missing env vars: ${missingEnvVars.join(", ")}`,
    };
    overallStatus = "error";
  }

  // Optional env vars (Telegram)
  const optionalEnvVars = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_ADMIN_CHAT_ID"];
  const missingOptional = optionalEnvVars.filter((v) => !process.env[v]);
  if (missingOptional.length > 0) {
    checks.telegram = {
      status: "ok",
      message: `Optional vars not set: ${missingOptional.join(", ")}`,
    };
  } else {
    checks.telegram = { status: "ok", message: "Configured" };
  }

  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
  };

  const statusCode = overallStatus === "error" ? 503 : 200;

  return NextResponse.json(response, { status: statusCode });
}
