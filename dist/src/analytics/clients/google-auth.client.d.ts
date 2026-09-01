import { ConfigService } from '@nestjs/config';
export declare class GoogleAuthClient {
    private readonly configService;
    private readonly logger;
    private _jwtClient;
    private _clientEmail;
    private _privateKey;
    constructor(configService: ConfigService);
    private initializeAuth;
    get jwtClient(): any;
    get clientEmail(): string | undefined;
    get privateKey(): string | undefined;
}
