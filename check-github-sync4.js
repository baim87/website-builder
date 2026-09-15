const { Queue } = require('bullmq');
const IORedis = require('ioredis');
async function main() {
  const connection = new IORedis('redis://localhost:6379');
  const queue = new Queue('github-sync', { connection });
  console.log(`Waiting: ${await queue.getWaitingCount()}`);
  console.log(`Failed: ${await queue.getFailedCount()}`);
  
  const failed = await queue.getFailed();
  for (const f of failed) {
    console.log(f.id, f.failedReason, f.data.directory);
  }
  process.exit(0);
}
main();
