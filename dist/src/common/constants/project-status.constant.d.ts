export declare const PROJECT_STATUS: {
    readonly DRAFT: "draft";
    readonly GENERATING: "generating";
    readonly PREVIEW: "preview";
    readonly LIVE: "live";
    readonly ARCHIVED: "archived";
};
export type ProjectStatusType = typeof PROJECT_STATUS[keyof typeof PROJECT_STATUS];
