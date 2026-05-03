import { PrismaClient, Prisma } from "@prisma/client"; // TS Change: Added Prisma for types

// Normalizes DATABASE_URL (SSL, Neon pooler) before any Prisma use
import { DATABASE_URL } from "./env"; // TS Change: Removed .js extension

/**
 * TS Change: Extend globalThis to include the prisma instance.
 * This prevents type errors when attaching prisma to the global object.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// TS Change: Added explicit return type : PrismaClient
function createPrismaClient(): PrismaClient {
  // TS Change: Typed the options object using Prisma.PrismaClientOptions
  const options: Prisma.PrismaClientOptions = {
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"]
  };

  if (DATABASE_URL) {
    options.datasources = {
      db: { url: DATABASE_URL }
    };
  }

  return new PrismaClient(options);
}

const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Reuse one client per process (critical for Neon: avoids duplicate pools).
// In dev, global survives nodemon reloads so connections are not leaked.
globalForPrisma.prisma = prisma;

export default prisma;