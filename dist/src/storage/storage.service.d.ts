import { ConfigService } from '@nestjs/config';
import { StorageProvider } from './interfaces/storage.interface';
export declare class StorageService implements StorageProvider {
    private readonly client;
    private readonly bucket;
    private readonly publicUrl;
    private readonly logger;
    constructor(configService: ConfigService);
    upload(key: string, body: Buffer | Uint8Array | string, contentType?: string): Promise<string>;
    download(key: string): Promise<Buffer>;
    delete(key: string): Promise<void>;
    getSignedUrl(key: string, expiresIn?: number): Promise<string>;
}
