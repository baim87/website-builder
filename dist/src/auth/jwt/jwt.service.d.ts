import { JwtService as NestJwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
export interface JwtPayload {
    sub: string;
    email: string;
}
export declare class JwtTokenService {
    private readonly jwtService;
    private readonly configService;
    constructor(jwtService: NestJwtService, configService: ConfigService);
    signAccessToken(userId: string, email: string): string;
    signRefreshToken(userId: string, email: string): string;
    verifyToken(token: string): JwtPayload;
}
