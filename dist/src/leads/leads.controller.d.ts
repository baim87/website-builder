import { LeadsService } from './leads.service';
export declare class LeadsController {
    private readonly leadsService;
    constructor(leadsService: LeadsService);
    submitLead(projectId: string, leadData: any): Promise<{
        success: boolean;
        message: string;
    }>;
}
