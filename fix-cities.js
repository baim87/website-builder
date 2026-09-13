const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.businessContext.update({
    where: { projectId: 'aaabde9d-2599-4f4c-9106-aabb14aa66f4' },
    data: { serviceAreas: ["Omaha, NE", "Council Bluffs, IA", "Carter Lake, IA", "Bellevue, NE", "Ralston, NE", "La Vista, NE", "Papillion, NE", "Chautauqua, IA", "Crescent, IA", "Offutt Air Force Base, NE"] }
  });
  console.log("Updated cities!");
}
main().catch(console.error).finally(() => prisma.$disconnect());
