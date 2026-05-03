import prisma from "./src/config/prisma.js";

async function main() {
  // Ordered to handle constraints if CASCADE wasn't used, but CASCADE is used here.
  const tablenames = [
    'Subscription',
    'Invoice',
    'Payment',
    'Notification',
    'Vote',
    'Follow',
    'Comment',
    'Post',
    'User',
    'Category',
    'Neighborhood'
  ];

  console.log("Truncating all tables...");
  
  for (const tablename of tablenames) {
    try {
      // Use double quotes for table names to handle case-sensitivity in Postgres
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE;`);
      console.log(`✅ Truncated ${tablename}`);
    } catch (error) {
      console.error(`❌ Error truncating ${tablename}:`, error);
    }
  }

  console.log("All data removed while keeping column structure.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
