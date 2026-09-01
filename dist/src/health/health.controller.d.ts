import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../storage/storage.service';
export declare class HealthController {
    private readonly prisma;
    private readonly configService;
    private readonly storage;
    constructor(prisma: PrismaService, configService: ConfigService, storage: StorageService);
    check(): Promise<any>;
}
