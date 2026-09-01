import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
export declare const createS3Client: (config: ConfigService) => S3Client;
