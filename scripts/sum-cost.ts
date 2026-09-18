import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const projectId = '61c5b4b8-664f-4395-87d2-6dc977e09e38';

  const imageCostResult = await prisma.skillInvocation.aggregate({
    _sum: { cost: true },
    _count: true,
    where: {
      projectId,
      model: 'bytedance-seed/seedream-4.5'
    }
  });

  const totalImageCost = imageCostResult._sum.cost || 0;
  const totalImages = imageCostResult._count;

  const totalCostResult = await prisma.skillInvocation.aggregate({
    _sum: { cost: true },
    where: { projectId }
  });

  const totalCost = totalCostResult._sum.cost || 0;

  const totalPagesResult = await prisma.page.count({
    where: { projectId }
  });

  const costPerPage = totalPagesResult > 0 ? totalCost / totalPagesResult : 0;

  console.log('--- COST BREAKDOWN ---');
  console.log(`Total Pages Generated:   ${totalPagesResult}`);
  console.log(`Total Images Generated:  ${totalImages}`);
  console.log(`Total Image Cost:        $${totalImageCost.toFixed(2)}`);
  console.log(`------------------------`);
  console.log(`TOTAL PROJECT COST:      $${totalCost.toFixed(2)}`);
  console.log(`AVERAGE COST PER PAGE:   $${costPerPage.toFixed(2)}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
