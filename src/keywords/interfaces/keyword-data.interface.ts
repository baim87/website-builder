export interface KeywordResult {
  keyword: string;
  searchVolume: number;
  monthlySearchVolumes?: { month: string; year: string; monthlySearches: number }[];
  competition?: string; // From Google Ads (LOW/MEDIUM/HIGH)
  cpc?: number;         // Cost per click, from Google Ads
  source: 'google' | 'cache';
}
