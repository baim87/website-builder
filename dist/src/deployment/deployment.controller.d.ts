import { DeploymentService } from './deployment.service';
export declare class DeploymentController {
    private readonly deploymentService;
    constructor(deploymentService: DeploymentService);
    deploy(projectId: string, req: any): Promise<{
        success: boolean;
        deploymentId: string;
        status: string;
        url: string;
        project: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            name: string;
            userId: string;
            status: string;
        };
    }>;
    getStatus(projectId: string, req: any): Promise<{
        projectId: string;
        status: string;
        ready: boolean;
    }>;
    revalidate(projectId: string, path: string, req: any): Promise<{
        success: boolean;
        path: string;
        domain: string;
        result: any;
    }>;
}
