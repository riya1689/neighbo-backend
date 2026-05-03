import "./config/env.js"; // TS Change: Removed .js
import app from "./app.js";
import prisma from "./config/prisma.js";
import { PORT, SSL_STORE_ID, SSL_IS_SANDBOX } from "./config/env.js";
import { Server } from "http"; // TS Change: Imported Server type

// 🚀 Only ONE listener for the whole app
// TS Change: Explicitly typed server as Server
const server: Server = app.listen(PORT, () => {
  console.log(`🚀 Neighbo backend running on http://localhost:${PORT}`);

  // SSLCommerz Startup Check
  if (SSL_STORE_ID) {
    const mode: string = SSL_IS_SANDBOX ? 'Sandbox' : 'Live';
    console.log(`💳 SSLCommerz: Connected (Mode: ${mode})`);
  }
});

/**
 * Graceful Shutdown Logic
 * TS Change: Added type for signal string
 */
function shutdown(signal: string): void {
  console.log(`\n${signal} received, closing server and database connections...`);
  server.close(() => {
    prisma.$disconnect().finally(() => {
      console.log("👋 Database disconnected. Goodbye!");
      process.exit(0);
    });
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));