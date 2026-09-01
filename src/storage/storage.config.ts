import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

export const createS3Client = (config: ConfigService): S3Client => {
  const isProd = config.get<string>('NODE_ENV') === 'production';
  
  if (isProd) {
    return new S3Client({
      region: 'auto',
      endpoint: config.get<string>('R2_ENDPOINT')!,
      credentials: {
        accessKeyId: config.get<string>('R2_ACCESS_KEY_ID')!,
        secretAccessKey: config.get<string>('R2_SECRET_ACCESS_KEY')!,
      },
    });
  }

  // Local MinIO
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
