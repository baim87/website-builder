import { AIGatewayService } from '../ai-gateway/ai-gateway.service';
import { EditExecutorService } from './edit-executor.service';
import { OutputValidatorService } from '../guardrails/output-validator.service';
export declare class EditIntentService {
    private readonly aiGateway;
    private readonly editExecutor;
    private readonly validator;
    private readonly logger;
    constructor(aiGateway: AIGatewayService, editExecutor: EditExecutorService, validator: OutputValidatorService);
    detectAndApplyEdit(projectId: string, userMessage: string, currentWebsiteData: any): Promise<boolean>;
}
