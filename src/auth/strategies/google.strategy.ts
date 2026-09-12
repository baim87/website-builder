import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly configService: ConfigService,
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
    const email = emails?.[0]?.value;

    if (!email) {
      return done(new UnauthorizedException('No email found in Google profile'), false);
    }

    // Check domain restriction if ALLOWED_AUTH_DOMAINS is set
    const allowedDomainsStr = this.configService.get<string>('ALLOWED_AUTH_DOMAINS');
    if (allowedDomainsStr) {
      const allowedDomains = allowedDomainsStr.split(',').map(d => d.trim().toLowerCase());
      const userDomain = email.split('@')[1]?.toLowerCase();
      
      // If allowedDomains doesn't include '*' and the user's domain isn't in the list
      if (!allowedDomains.includes('*') && !allowedDomains.includes(userDomain)) {
        return done(new UnauthorizedException(`Sign-in is currently restricted to allowed domains. Email ${email} is not authorized.`), false);
      }
    }

    const user = await this.authService.findOrCreateUser({
      email,
      name: profile.displayName || (name ? `${name.givenName || ''} ${name.familyName || ''}`.trim() : ''),
      googleId: id,
      gmailRefreshToken: refreshToken,
    });
    
    done(null, user);
  }
}
