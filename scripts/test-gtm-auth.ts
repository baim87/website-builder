import { GoogleAuth } from 'google-auth-library';
import { execSync } from 'child_process';

async function main() {
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const accountId = process.env.GOOGLE_TAG_MANAGER_ACCOUNT_ID;

  if (!privateKey || !clientEmail || !accountId) {
    throw new Error('Missing credentials in .env');
  }

  const auth = new GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/tagmanager.readonly'],
  });

  const client = await auth.getClient();
  const token = await client.getAccessToken();

  console.log('✅ Successfully generated OAuth token for Tag Manager');
  console.log('Testing cURL against GTM API for Account:', accountId);

  // Example cURL to list containers in the GTM account
  const curlCmd = `curl -s -H "Authorization: Bearer ${token.token}" \\
    "https://tagmanager.googleapis.com/tagmanager/v2/accounts/${accountId}/containers"`;

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

require('dotenv').config();
main().catch(console.error);
