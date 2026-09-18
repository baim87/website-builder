const { BetaAnalyticsDataClient } = require('@google-analytics/data');
require('dotenv').config({path: '.env'}); 

async function main() {
  const credentials = {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };
  const gaDataClient = new BetaAnalyticsDataClient({ credentials });
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const analytics = await prisma.siteAnalytics.findUnique({
    where: { projectId: '23698e47-6b42-4701-8379-f039dad9dabd' },
  });
  const propId = analytics.ga4PropertyId;
  
  const testQ = async (name, dim) => {
    try {
      await gaDataClient.runRealtimeReport({
        property: `properties/${propId}`,
        metrics: [{ name: 'activeUsers' }],
        dimensions: [{ name: dim }],
      });
      console.log('SUCCESS:', name);
    } catch(e) {
      console.error('FAIL:', name, e.message);
    }
  }

  await testQ('minutesAgo', 'minutesAgo');
  await testQ('firstUserSource', 'firstUserSource');
  await testQ('audienceName', 'audienceName');
  await testQ('unifiedScreenName', 'unifiedScreenName');
  await testQ('city', 'city');
  await testQ('country', 'country');
  
  process.exit(0);
}
main();
