export declare const TRADES: {
    readonly ROOFING: "roofing";
    readonly HVAC: "hvac";
    readonly PLUMBING: "plumbing";
    readonly ELECTRICAL: "electrical";
    readonly LANDSCAPING: "landscaping";
    readonly GENERAL_CONTRACTOR: "general_contractor";
    readonly PAINTING: "painting";
    readonly CLEANING: "cleaning";
    readonly PEST_CONTROL: "pest_control";
    readonly OTHER: "other";
};
export type TradeType = typeof TRADES[keyof typeof TRADES];
