import { GbpService } from './gbp.service';
import { z } from 'zod';
declare const LookupSchema: z.ZodObject<{
    businessName: z.ZodString;
    location: z.ZodString;
}, z.core.$strip>;
type LookupDto = z.infer<typeof LookupSchema>;
export declare class GbpController {
    private readonly gbpService;
    constructor(gbpService: GbpService);
    lookup(query: LookupDto): Promise<{
        data: any;
    }>;
}
export {};
