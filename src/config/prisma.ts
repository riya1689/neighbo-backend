import { PrismaClient } from "../generated/client/index.js";
import type { Prisma } from "../generated/client/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// Normalizes DATABASE_URL (SSL, Neon pooler) before any Prisma use
import { DATABASE_URL } from "./env.js";

/**
 * TS Change: Extend globalThis to include the prisma instance.
 * This prevents type errors when attaching prisma to the global object.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// TS Change: Added explicit return type : PrismaClient
function createPrismaClient(): PrismaClient {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const adapter = new PrismaPg(pool);

  const options: Prisma.PrismaClientOptions = {
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"]
  };

  return new PrismaClient(options);
}

const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Reuse one client per process (critical for Neon: avoids duplicate pools).
// In dev, global survives nodemon reloads so connections are not leaked.
globalForPrisma.prisma = prisma;

export default prisma;