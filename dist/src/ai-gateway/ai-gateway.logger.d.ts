export declare class AIGatewayLogger {
    private readonly logger;
    logCall(model: string, latencyMs: number, usage: {
        promptTokens: number;
        completionTokens: number;
    }): void;
    logError(model: string, error: Error): void;
}
