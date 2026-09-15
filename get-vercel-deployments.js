const { VercelClient } = require('./dist/src/vercel/vercel.client.js');
const { ConfigService } = require('@nestjs/config');
const dotenv = require('dotenv');
dotenv.config();
async function main() {
  const config = { get: (k) => process.env[k] };
  const client = new VercelClient(config);
  const data = await client.getProjectDeployments('remodeling-journey-2369');
  console.log(JSON.stringify(data.deployments.slice(0, 3).map(d => ({ state: d.readyState, url: d.url, created: new Date(d.createdAt).toISOString() })), null, 2));
}
main();
