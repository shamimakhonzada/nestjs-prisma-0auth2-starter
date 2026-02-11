import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor() {
    super({
      clientID: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      callbackURL: process.env.GITHUB_CALLBACK!,
      scope: ['user:email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
  ): Promise<any> {
    const email =
      profile.emails?.find((e: any) => e.primary)?.value || profile._json.email;

    return {
      provider: 'github',
      providerId: profile.id,
      email,
      name: profile.displayName || profile.username,
      picture: profile.photos?.[0]?.value,
      accessToken,
      refreshToken,
    };
  }
}
