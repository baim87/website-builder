const { Queue } = require('bullmq');
const IORedis = require('ioredis');

async function main() {
  const connection = new IORedis('redis://localhost:6379');
  const queue = new Queue('analytics-provisioning', { connection });
  
  const projectId = '23698e47-6b42-4701-8379-f039dad9dabd';
  // Wait, I need the domain and userId for the job data!
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  
  const domain = await prisma.domain.findFirst({ where: { projectId }});
  const project = await prisma.project.findUnique({ where: { id: projectId }});
  
  console.log(`Adding job for domain: ${domain.domainName}, userId: ${project.userId}`);
  
  await queue.add('provision', {
    projectId,
    domain: domain.domainName,
    userId: project.userId
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 }
  });
  
  console.log("Job added!");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
