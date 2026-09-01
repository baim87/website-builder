import { PrismaService } from '../prisma/prisma.service';
interface CreateUserDto {
    email: string;
    name: string;
    googleId: string;
    gmailRefreshToken?: string;
}
export declare class AuthService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findOrCreateUser(dto: CreateUserDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string | null;
        email: string;
        googleId: string | null;
        gmailRefreshToken: string | null;
    }>;
    findUserById(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string | null;
        email: string;
        googleId: string | null;
        gmailRefreshToken: string | null;
    } | null>;
}
export {};
