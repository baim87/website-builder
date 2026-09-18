import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteUser(userId: string) {
  console.log(`Attempting to delete user ${userId}...`);

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        projects: true
      }
    });

    if (!user) {
      console.log('User not found.');
      return;
    }

    console.log(`Found user: ${user.email}. Deleting...`);

    // Manually delete SkillInvocations to avoid FK constraint issues since it lacks Cascade on User relation
    await prisma.skillInvocation.deleteMany({
      where: { userId }
    });
    
    // Now delete the user, which will Cascade to Projects, Payments, Subscriptions, and everything else
    await prisma.user.delete({
      where: { id: userId }
    });

    console.log('Successfully deleted user and all cascading data.');
  } catch (error) {
    console.error('Error deleting user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

const userId = process.argv[2];
if (!userId) {
  console.error('Please provide a user ID.');
  process.exit(1);
}

deleteUser(userId);
