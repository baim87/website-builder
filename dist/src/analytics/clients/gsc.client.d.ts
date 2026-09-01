import { GoogleAuthClient } from './google-auth.client';
export declare class GscClient {
    private readonly authClient;
    private readonly logger;
    private gscApi;
    constructor(authClient: GoogleAuthClient);
    verifySite(domainName: string): Promise<void>;
}
