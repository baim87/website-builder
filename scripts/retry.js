const { Queue } = require('bullmq');
const IORedis = require('ioredis');

async function main() {
  const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');
  const queue = new Queue('site-generation', { connection });
  
  const jobId = 'generate-56ed4863-a3c5-4012-bed2-df152e9333d4-1789355089460';
  const job = await queue.getJob(jobId);
  if (!job) {
    console.log(`Job ${jobId} not found`);
    process.exit(1);
  }
  
  console.log(`Retrying job ${jobId}...`);
  await job.retry();
  console.log('Job retried successfully!');
  
  process.exit(0);
}

main().catch(console.error);
