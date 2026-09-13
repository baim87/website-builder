import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import { StorageProvider } from './interfaces/storage.interface';
import { createS3Client } from './storage.config';
import { Readable } from 'stream';

@Injectable()
export class StorageService implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly logger = new Logger(StorageService.name);

  constructor(configService: ConfigService) {
    this.client = createS3Client(configService);
    this.bucket = configService.get<string>('R2_BUCKET_NAME') || 'local-bucket';
    this.publicUrl = configService.get<string>('R2_PUBLIC_URL') || 'http://localhost:9000/local-bucket';
  }

  async upload(key: string, body: Buffer | Uint8Array | string, contentType?: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    });
    await this.client.send(command);
    this.logger.log(`Uploaded ${key} to ${this.bucket}`);
    return `${this.publicUrl}/${key}`;
  }

  async download(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    const response = await this.client.send(command);
    if (!response.Body) {
      throw new Error('No body returned from S3');
    }
    const stream = response.Body as Readable;
    const chunks: any[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    await this.client.send(command);
    this.logger.log(`Deleted ${key} from ${this.bucket}`);
  }

  async deleteDirectory(prefix: string): Promise<void> {
    try {
      let isTruncated = true;
      let continuationToken: string | undefined;
      let totalDeleted = 0;

      while (isTruncated) {
        const listCommand = new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        });

        const listResponse = await this.client.send(listCommand);

        if (!listResponse.Contents || listResponse.Contents.length === 0) {
          break;
        }

        const deleteParams = {
          Bucket: this.bucket,
          Delete: {
            Objects: listResponse.Contents.map((item) => ({ Key: item.Key })),
          },
        };

        const deleteCommand = new DeleteObjectsCommand(deleteParams);
        const deleteResponse = await this.client.send(deleteCommand);
        totalDeleted += deleteResponse.Deleted?.length || 0;

        isTruncated = listResponse.IsTruncated ?? false;
        continuationToken = listResponse.NextContinuationToken;
      }
      this.logger.log(`Deleted directory/prefix ${prefix} from ${this.bucket} (${totalDeleted} objects)`);
    } catch (error) {
      this.logger.error(`Failed to delete directory/prefix ${prefix}:`, error);
      throw error;
    }
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }
}
