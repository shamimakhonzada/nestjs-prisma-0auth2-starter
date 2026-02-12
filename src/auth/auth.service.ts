// auth.service.ts
import { ConflictException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from 'src/user/dto/create-user.dto';

interface OAuthProfile {
  email: string;
  name?: string | null;
  picture?: string | null;
  provider: string;
  providerId: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number; // usually seconds from epoch
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async oauthLogin(profile: OAuthProfile) {
    // ────────────────────────────────────────────────
    // Use transaction to make it atomic & safe
    // ────────────────────────────────────────────────
    return this.prisma.$transaction(
      async (tx) => {
        // Try to find existing user
        let user = await tx.user.findUnique({
          where: { email: profile.email },
        });

        const now = new Date();

        if (!user) {
          // Create new user
          user = await tx.user.create({
            data: {
              email: profile.email,
              name: profile.name ?? null,
              picture: profile.picture ?? null,
            },
          });
        } else {
          // Update profile if better/new data exists
          // Only update if new value is truthy and different
          const shouldUpdate =
            (profile.name && profile.name !== user.name) ||
            (profile.picture && profile.picture !== user.picture);

          if (shouldUpdate) {
            user = await tx.user.update({
              where: { id: user.id },
              data: {
                name: profile.name ?? user.name,
                picture: profile.picture ?? user.picture,
                // emailVerified: now,  // optional: refresh verification date
              },
            });
          }
        }

        // ────────────────────────────────────────────────
        // Always upsert the OAuth account (tokens refresh)
        // ────────────────────────────────────────────────
        await tx.oAuthAccount.upsert({
          where: {
            provider_providerId: {
              provider: profile.provider,
              providerId: profile.providerId,
            },
          },
          update: {
            accessToken: profile.accessToken,
            refreshToken: profile.refreshToken,
            expiresAt: profile.expiresAt
              ? new Date(profile.expiresAt * 1000)
              : null,
            // lastRefreshed: now, // optional field you can add
          },
          create: {
            provider: profile.provider,
            providerId: profile.providerId,
            accessToken: profile.accessToken,
            refreshToken: profile.refreshToken,
            expiresAt: profile.expiresAt
              ? new Date(profile.expiresAt * 1000)
              : null,
            userId: user.id,
          },
        });

        // ────────────────────────────────────────────────
        // Return safe payload
        // ────────────────────────────────────────────────
        const payload = { sub: user.id, email: user.email };

        return {
          accessToken: this.jwtService.sign(payload),
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            picture: user.picture,
            // emailVerified: user.emailVerified,
          },
        };
      },
      { maxWait: 10000, timeout: 15000 },
    );
  }
}
