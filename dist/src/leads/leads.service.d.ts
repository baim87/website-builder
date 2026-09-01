import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
export declare class LeadsService {
    private readonly prisma;
    private readonly configService;
    private readonly logger;
    private transporter;
    constructor(prisma: PrismaService, configService: ConfigService);
    private initializeMailer;
    forwardLead(projectId: string, leadData: any): Promise<{
        success: boolean;
        message: string;
    }>;
}
