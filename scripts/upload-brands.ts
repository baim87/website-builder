import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

const client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const bucket = process.env.R2_BUCKET_NAME || 'localempire';

const brands = [
  { name: 'Trex', domain: 'trex.com' },
  { name: 'TimberTech', domain: 'timbertech.com' },
  { name: 'Westbury Aluminum Railing', domain: 'diggerspecialties.com' }, // Westbury is by DSI
  { name: 'Fiberon', domain: 'fiberondecking.com' }
];

async function main() {
  for (const brand of brands) {
    try {
      console.log(`Fetching logo for ${brand.name} (${brand.domain})...`);
      const apiResponse = await axios.get(`https://api.brandfetch.io/v2/brands/${brand.domain}`, {
        headers: { Authorization: `Bearer ${process.env.BRANDFETCH_API_KEY}` }
      });
      
      const logoUrl = apiResponse.data?.logos?.[0]?.formats?.[0]?.src;
      if (!logoUrl) throw new Error("No logo found in Brandfetch response");
      
      const response = await axios.get(logoUrl, { responseType: 'arraybuffer' });
      
      const key = `global/brands/${brand.domain}/logo.png`;
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: response.data,
        ContentType: 'image/png',
      });
      
      await client.send(command);
      console.log(`Successfully uploaded ${brand.name} to ${key}`);
      console.log(`URL: ${process.env.R2_PUBLIC_URL}/${key}`);
    } catch (error) {
      console.error(`Failed to process ${brand.name}:`, error.message);
    }
  }
}

main().catch(console.error);
