import prisma from "./src/config/prisma.js";

async function main() {
  console.log("Seeding neighborhoods...");
  
  const neighborhoods = [
    { name: "Dhanmondi", description: "Residential area in Dhaka" },
    { name: "Banani", description: "Upscale residential and commercial area" },
    { name: "Uttara", description: "Modern residential hub" },
    { name: "Gulshan", description: "Diplomatic and business zone" },
  ];

  for (const n of neighborhoods) {
    await prisma.neighborhood.upsert({
      where: { name: n.name },
      update: {},
      create: n,
    });
    console.log(`✅ Seeded ${n.name}`);
  }

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
