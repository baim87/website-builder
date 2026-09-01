export declare class InputSanitizerService {
    private readonly promptInjectionHeuristics;
    private readonly piiHeuristics;
    sanitize(input: string): string;
}
