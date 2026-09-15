const { Queue } = require('bullmq');
const IORedis = require('ioredis');
async function main() {
  const connection = new IORedis('redis://localhost:6379');
  const queue = new Queue('github-sync', { connection });
  const completed = await queue.getCompleted(0, 10);
  console.log("Completed jobs:");
  for (const j of completed) {
    console.log(j.id, j.finishedOn, j.returnvalue);
  }
  process.exit(0);
}
main();
