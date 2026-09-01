import type { Response } from 'express';
import { JwtTokenService } from './jwt/jwt.service';
import { ConfigService } from '@nestjs/config';
export declare class AuthController {
    private readonly jwtTokenService;
    private readonly configService;
    constructor(jwtTokenService: JwtTokenService, configService: ConfigService);
    googleAuth(): Promise<void>;
    googleAuthRedirect(req: any, res: Response): Promise<void>;
    refreshToken(req: any, res: Response): Promise<Response<any, Record<string, any>>>;
    logout(res: Response): Promise<Response<any, Record<string, any>>>;
    getProfile(user: any): Promise<any>;
}
