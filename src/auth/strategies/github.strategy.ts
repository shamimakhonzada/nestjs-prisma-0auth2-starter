import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';

export interface GithubOAuthUser {
  provider: 'GITHUB';
  providerId: string;
  email: string;
  name: string | null;
  avatar: string | null;
  accessToken: string;
  refreshToken: string | null;
}

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.getOrThrow<string>('GITHUB_CLIENT_ID'),
      clientSecret: configService.getOrThrow<string>('GITHUB_CLIENT_SECRET'),
      callbackURL: configService.getOrThrow<string>('GITHUB_CALLBACK'),
      scope: ['user:email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (err: Error | null, user?: GithubOAuthUser) => void,
  ): Promise<void> {
    // GitHub may return multiple emails; prefer the primary verified one
    const primaryEmail =
      (
        profile.emails as
          | Array<{ value: string; primary?: boolean; verified?: boolean }>
          | undefined
      )?.find((e) => e.primary && e.verified)?.value ??
      profile.emails?.[0]?.value ??
      '';

    const user: GithubOAuthUser = {
      provider: 'GITHUB',
      providerId: String(profile.id),
      email: primaryEmail,
      name: profile.displayName || (profile as any).username || null,
      avatar: profile.photos?.[0]?.value ?? null,
      accessToken,
      refreshToken: refreshToken ?? null,
    };
    done(null, user);
  }
}
