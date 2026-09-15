const { Queue } = require('bullmq');
const IORedis = require('ioredis');
async function main() {
  const connection = new IORedis('redis://localhost:6379');
  const queue = new Queue('github-sync', { connection });
  console.log(`Active: ${await queue.getActiveCount()}`);
  console.log(`Waiting: ${await queue.getWaitingCount()}`);
  console.log(`Failed: ${await queue.getFailedCount()}`);
  console.log(`Delayed: ${await queue.getDelayedCount()}`);
  console.log(`Completed: ${await queue.getCompletedCount()}`);
  
  const failed = await queue.getFailed();
  if (failed.length > 0) {
    console.log(failed[0].failedReason);
  }
  process.exit(0);
}
main();
