import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { JwtTokenService } from './jwt/jwt.service';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(
    private readonly jwtTokenService: JwtTokenService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Initiates the Google OAuth flow
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: any, @Res() res: Response) {
    const user = req.user;
    const accessToken = this.jwtTokenService.signAccessToken(user.id, user.email);
    const refreshToken = this.jwtTokenService.signRefreshToken(user.id, user.email);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'lax',
    });

    const frontendUrl = this.configService.get('FRONTEND_URL');
    return res.redirect(`${frontendUrl}/dashboard?token=${accessToken}`);
  }

  @Public()
  @Post('refresh')
  async refreshToken(@Req() req: any, @Res() res: Response) {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ message: 'No refresh token provided' });
    }

    try {
      const payload = this.jwtTokenService.verifyToken(refreshToken);
      const newAccessToken = this.jwtTokenService.signAccessToken(payload.sub, payload.email);
      const newRefreshToken = this.jwtTokenService.signRefreshToken(payload.sub, payload.email);

      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: this.configService.get('NODE_ENV') === 'production',
        sameSite: 'lax',
      });

      return res.json({ accessToken: newAccessToken });
    } catch (e) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }
  }

  @Public()
  @Post('logout')
  async logout(@Res() res: Response) {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'lax',
    });
    return res.json({ success: true });
  }

  @Get('me')
  async getProfile(@CurrentUser() user: any) {
    return user;
  }
}
