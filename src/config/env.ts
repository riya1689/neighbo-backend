import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename: string = fileURLToPath(import.meta.url); // TS Change: Explicit type string
const __dirname: string = path.dirname(__filename); // TS Change: Explicit type string

// Explicitly find the root directory
const rootDir: string = path.resolve(__dirname, "../../");
const envPath: string = path.join(rootDir, ".env");

// 🛡️ Safety Check: Does the file even exist where we think it does?
// if (!fs.existsSync(envPath)) {
//   console.error(`❌ ERROR: .env file not found at: ${envPath}`);
// } else {
//   const result = dotenv.config({ path: envPath });
//   if (result.error) {
//     console.error("❌ ERROR: Failed to parse .env file:", result.error);
//   }
// }

if (!fs.existsSync(envPath)) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`⚠️ Warning: .env file not found at: ${envPath}`);
  }
} else {
  dotenv.config({ path: envPath });
}

/**
 * Ensures Neon / cloud PostgreSQL URLs use TLS.
 */
// TS Change: Added type for urlString and return type
export function ensureDatabaseUrlForCloudPostgres(urlString: string | undefined): string | undefined {
  if (!urlString || typeof urlString !== "string") return urlString;

  const url = new URL(urlString.trim());
  url.searchParams.set("sslmode", "require");

  if (url.hostname.includes("pooler") && !url.searchParams.has("pgbouncer")) {
    url.searchParams.set("pgbouncer", "true");
  }

  return url.toString();
}

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = ensureDatabaseUrlForCloudPostgres(process.env.DATABASE_URL);
}

// TS Change: Explicit type number
const PORT: number = process.env.PORT ? Number(process.env.PORT) : 5000;

// TS Change: Added type for name and return type
export function getRequiredEnv(name: string): string {
  const value = process.env[name];

  // Debug log to help you see what's happening in the terminal
  if (!value) {
    console.log(`🔍 Debug: Checking for ${name}... Result: MISSING`);
  }

  if (value === undefined || value === null || String(value).trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  // Strip leading/trailing quotes (single or double) to prevent credential errors
  return String(value).trim().replace(/^["']|["']$/g, "");
}

// TS Change: Explicit type string[]
export const ALLOWED_ORIGINS: string[] = (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim().replace(/^["']|["']$/g, ""))
  : ['http://localhost:3000'];

export const DATABASE_URL: string = getRequiredEnv("DATABASE_URL");
export const JWT_SECRET: string = getRequiredEnv("JWT_SECRET");
export const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || "7d";
export const FRONTEND_URL: string = process.env.FRONTEND_URL || "http://localhost:3000";
export { PORT };

export const SSL_STORE_ID: string = getRequiredEnv("SSL_STORE_ID");
export const SSL_STORE_PASS: string = getRequiredEnv("SSL_STORE_PASS");
export const SSL_IS_SANDBOX: boolean = (process.env.SSL_IS_SANDBOX || "").trim().replace(/^["']|["']$/g, "") === "true";
export const SSL_SUCCESS_URL: string = getRequiredEnv("SSL_SUCCESS_URL");
export const SSL_FAIL_URL: string = getRequiredEnv("SSL_FAIL_URL");
export const SSL_CANCEL_URL: string = getRequiredEnv("SSL_CANCEL_URL");