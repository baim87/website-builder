const { Queue } = require('bullmq');
const IORedis = require('ioredis');
async function main() {
  const connection = new IORedis('redis://localhost:6379');
  const queue = new Queue('analytics-provisioning', { connection });
  console.log(`Active: ${await queue.getActiveCount()}`);
  console.log(`Waiting: ${await queue.getWaitingCount()}`);
  console.log(`Failed: ${await queue.getFailedCount()}`);
  console.log(`Completed: ${await queue.getCompletedCount()}`);
  
  const failed = await queue.getFailed();
  for (const f of failed) {
    console.log(f.id, f.failedReason, f.data);
  }
  process.exit(0);
}
main();
