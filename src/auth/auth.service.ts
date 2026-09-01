import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateUserDto {
  email: string;
  name: string;
  googleId: string;
  gmailRefreshToken?: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateUser(dto: CreateUserDto) {
    let user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (user) {
      if (dto.gmailRefreshToken && user.gmailRefreshToken !== dto.gmailRefreshToken) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { gmailRefreshToken: dto.gmailRefreshToken, googleId: dto.googleId },
        });
      }
      return user;
    }

    return this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        googleId: dto.googleId,
        gmailRefreshToken: dto.gmailRefreshToken,
      },
    });
  }

  async findUserById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
