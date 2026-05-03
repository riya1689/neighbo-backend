import prisma from "./src/config/prisma.js";

async function main() {
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
