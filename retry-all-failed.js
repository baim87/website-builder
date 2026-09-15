const IORedis = require('ioredis');
const { Queue } = require('bullmq');
async function main() {
  const connection = new IORedis('redis://localhost:6379');
  const queue = new Queue('site-generation', { connection });
  const failed = await queue.getFailed();
  if (failed.length === 0) {
    console.log('No failed jobs found.');
  } else {
    for (const job of failed) {
      console.log(`Retrying job ${job.id}...`);
      await job.retry();
    }
  }
  process.exit(0);
}
main();
