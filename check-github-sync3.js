const { Queue } = require('bullmq');
const IORedis = require('ioredis');
async function main() {
  const connection = new IORedis('redis://localhost:6379');
  const queue = new Queue('github-sync', { connection });
  console.log(`Waiting: ${await queue.getWaitingCount()}`);
  const waiting = await queue.getWaiting();
  console.log("Waiting jobs:", waiting.map(j => j.id));
  process.exit(0);
}
main();
