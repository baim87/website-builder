import { GoogleAuth } from 'google-auth-library';
import { execSync } from 'child_process';

async function main() {
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const propertyId = process.env.GOOGLE_ANALYTICS_PROPERTY_ID;

  if (!privateKey || !clientEmail || !propertyId) {
    throw new Error('Missing credentials in .env');
  }

  const auth = new GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  });

  const client = await auth.getClient();
  const token = await client.getAccessToken();

  console.log('✅ Successfully generated OAuth token for:', clientEmail);
  console.log('Testing cURL against GA4 Data API for Property:', propertyId);

  // Example cURL to run a simple report
  const curlCmd = `curl -s -X POST \\
    -H "Authorization: Bearer ${token.token}" \\
    -H "Content-Type: application/json" \\
    "https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport" \\
    -d '{
      "dateRanges": [{"startDate": "7daysAgo", "endDate": "today"}],
      "metrics": [{"name": "activeUsers"}]
    }'`;

  try {
    const result = execSync(curlCmd, { encoding: 'utf8' });
    console.log('\n--- cURL Response ---');
    console.log(result);
  } catch (err: any) {
    console.error('cURL failed:', err.message);
    if (err.stdout) console.log(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
  }
}

// Ensure .env is loaded before running
require('dotenv').config();
main().catch(console.error);
