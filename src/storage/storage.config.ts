import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

export const createS3Client = (config: ConfigService): S3Client => {
  const r2Endpoint = config.get<string>('R2_ENDPOINT');
  
  if (!r2Endpoint) {
    throw new Error('R2_ENDPOINT is not configured');
  }

  return new S3Client({
    region: 'auto',
    endpoint: r2Endpoint,
    credentials: {
      accessKeyId: config.get<string>('R2_ACCESS_KEY_ID')!,
      secretAccessKey: config.get<string>('R2_SECRET_ACCESS_KEY')!,
    },
  });
};
