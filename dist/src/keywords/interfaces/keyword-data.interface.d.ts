export interface KeywordResult {
    keyword: string;
    searchVolume: number;
    competition?: string;
    cpc?: number;
    source: 'google' | 'cache';
}
