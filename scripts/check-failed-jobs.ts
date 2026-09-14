import { Queue } from 'bullmq';
import IORedis from 'ioredis';

async function checkFailed() {
  const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');
  
  // We need to know the queue name, let's try the common ones like 'generation', 'chat', 'default'
  const queues = ['generation', 'chat', 'chat-flow'];
  
  for (const q of queues) {
    const queue = new Queue(q, { connection });
    const failed = await queue.getFailed(0, 10);
    if (failed.length > 0) {
      console.log(`Failed jobs in queue ${q}:`);
      for (const job of failed) {
        console.log(`Job ID: ${job.id}`);
        console.log(`Failed Reason: ${job.failedReason}`);
        console.log(`Stacktrace: ${job.stacktrace}`);
      }
    } else {
      console.log(`No failed jobs in queue ${q}`);
    }
  }
  process.exit(0);
}
checkFailed().catch(console.error);
