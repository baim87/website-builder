export declare class SeoArtifactsService {
    generateSitemap(domain: string, pages: any[]): string;
    generateRobotsTxt(domain: string): string;
    generateJsonLd(businessContext: any, domain: string): any;
    generateInternalLinks(pages: any[]): Record<string, string[]>;
}
