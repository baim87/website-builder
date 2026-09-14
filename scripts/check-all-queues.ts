import { Queue } from 'bullmq';
import IORedis from 'ioredis';

async function checkFailed() {
  const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');
  
  const queues = [
    'site-generation',
    'asset-conversion',
    'analytics-provisioning',
    'billing-reconciliation',
    'deployment',
    'test-job',
    'quality-control',
    'image-generation',
    'github-sync',
    'deployment-tracker'
  ];
  
  for (const q of queues) {
    const queue = new Queue(q, { connection });
    const failed = await queue.getFailed(0, 10);
    const active = await queue.getActive(0, 5);
    if (failed.length > 0) {
      console.log(`Failed jobs in queue ${q}:`);
      for (const job of failed) {
        console.log(`\nJob ID: ${job.id}`);
        console.log(`Data: ${JSON.stringify(job.data).substring(0, 200)}...`);
        console.log(`Failed Reason: ${job.failedReason}`);
        console.log(`Stacktrace: ${job.stacktrace}`);
      }
    } else {
      console.log(`No failed jobs in queue ${q}. (Active: ${active.length})`);
    }
  }
  process.exit(0);
}
checkFailed().catch(console.error);
