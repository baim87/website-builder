import Redis from 'ioredis';

async function main() {
  const client = new Redis('redis://localhost:6379');
  
  const key = 'site-content:23698e47-6b42-4701-8379-f039dad9dabd';
  await client.del(key);
  console.log('Deleted key from redis:', key);
  
  const val = await client.get(key);
  console.log('Value is now:', val);

  await client.quit();
}

main();
