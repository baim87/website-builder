import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';
dotenv.config();

async function testR2() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    console.error('❌ Missing R2 credentials in .env');
    return;
  }

  console.log(`Testing connection to R2 bucket: ${bucketName}...`);

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  try {
    // Test 1: Upload a tiny test file
    console.log('Uploading test file...');
    await client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: 'test-connection.txt',
        Body: 'Hello from Contractor Website Builder!',
        ContentType: 'text/plain',
      })
    );
    console.log('✅ Upload successful!');

    // Test 2: List objects to verify it's there
    console.log('Listing objects...');
    const result = await client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        MaxKeys: 5,
      })
    );
    
    console.log('✅ Connection verified! Found objects:');
    if (result.Contents) {
      result.Contents.forEach(obj => console.log(`   - ${obj.Key} (${obj.Size} bytes)`));
    } else {
      console.log('   (No objects found)');
    }

  } catch (error: any) {
    console.error('❌ R2 Error:', error.message);
  }
}

testR2();
