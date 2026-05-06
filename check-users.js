import prisma from './src/config/prisma.js';

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, displayName: true, username: true, email: true }
  });
  console.log(JSON.stringify(users, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
