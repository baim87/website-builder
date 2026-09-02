import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

export const createS3Client = (config: ConfigService): S3Client => {
  const r2Endpoint = config.get<string>('R2_ENDPOINT');
  
  // If R2 credentials are provided in .env, always use them (even in dev)
  if (r2Endpoint && r2Endpoint.includes('r2.cloudflarestorage.com')) {
    return new S3Client({
      region: 'auto',
      endpoint: r2Endpoint,
      credentials: {
        accessKeyId: config.get<string>('R2_ACCESS_KEY_ID')!,
        secretAccessKey: config.get<string>('R2_SECRET_ACCESS_KEY')!,
      },
    });
  }

  // Fallback to Local MinIO if R2 is not configured
  return new S3Client({
    region: 'us-east-1',
    endpoint: 'http://localhost:9000',
    forcePathStyle: true,
    credentials: {
      accessKeyId: 'minioadmin',
      secretAccessKey: 'minioadmin',
    },
  });
};
