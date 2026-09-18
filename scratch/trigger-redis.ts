import { Queue } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const myQueue = new Queue('site-generation', { connection });

async function addJob() {
  await myQueue.add('generate-site', {
    projectId: '23698e47-6b42-4701-8379-f039dad9dabd',
    userId: 'c2d36645-cabb-45fa-abb0-6273d4604be5'
  });
  console.log('Job added to site-generation');
  process.exit(0);
}

addJob().catch(console.error);
