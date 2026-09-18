import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

async function testCurl() {
  try {
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;

    console.log('1. Fetching Access Token...');
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', null, {
      params: {
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      },
    });

    const accessToken = tokenRes.data.access_token;
    console.log('Got Access Token. Length:', accessToken.length);

    console.log('2. Curling Google Ads API for Keyword Ideas...');
    
    const requestBody = {
      keywordSeed: {
        keywords: ['Kitchen Remodeling Peoria, AZ']
      },
      pageSize: 15
    };

    const apiRes = await axios.post(
      `https://googleads.googleapis.com/v25/customers/${customerId}:generateKeywordIdeas`,
      requestBody,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': developerToken,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('SUCCESS API Response:', JSON.stringify(apiRes.data).substring(0, 500));
  } catch (err: any) {
    console.error('CURL ERROR:');
    if (err.response) {
      console.error(JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(err.message);
    }
  }
}

testCurl();
