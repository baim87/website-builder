import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID')!,
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET')!,
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL')!,
      scope: ['email', 'profile', 'https://www.googleapis.com/auth/gmail.send'],
      accessType: 'offline', // For refresh token
      prompt: 'consent',
    } as any);
  }

  async validate(
    _accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { name, emails, id } = profile;
    const user = await this.authService.findOrCreateUser({
      email: emails[0].value,
      name: profile.displayName || (name ? `${name.givenName || ''} ${name.familyName || ''}`.trim() : ''),
      googleId: id,
      gmailRefreshToken: refreshToken,
    });
    done(null, user);
  }
}
