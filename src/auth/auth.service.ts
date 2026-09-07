import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { db } from '../prisma/db.js';
import * as argon2 from 'argon2';
import type { SignUpDto } from './dto/create-auth.dto.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OAuthProfile {
  email: string;
  name?: string | null;
  avatar?: string | null;
  provider: 'GOOGLE' | 'GITHUB' | 'FACEBOOK';
  providerId: string;
  accessToken?: string;
  refreshToken?: string | null;
  expiresAt?: number; // seconds from epoch (unix timestamp)
}

export interface AuthResult {
  accessToken: string;
  user: Record<string, unknown>;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  // ── OAuth login / register ──────────────────────────────────────────────────

  async oauthLogin(profile: OAuthProfile): Promise<AuthResult> {
    if (!profile.email) {
      throw new BadRequestException(
        'OAuth provider did not return an email address. Please ensure your account has a verified email.',
      );
    }

    // The contract maps expiresAt → pg/timestamptz-temporal@1 which expects a
    // Date (or Temporal) value — NOT an ISO string. Build it once here.
    const expiresAt: Date | null = profile.expiresAt
      ? new Date(profile.expiresAt * 1000)
      : null;

    try {
      const user = await db.transaction(async (tx) => {
        // 1. Find or create the User record
        let user = await tx.orm.public.User.where((u) =>
          u.email.eq(profile.email),
        ).first();

        if (!user) {
          user = await tx.orm.public.User.create({
            email: profile.email,
            name: profile.name ?? null,
            avatar: profile.avatar ?? null,
          });

          const userRole = await tx.orm.public.Role.where({
            name: 'USER',
          }).first();
          if (!userRole) {
            throw new InternalServerErrorException(
              'The default USER role is not configured',
            );
          }
          await tx.orm.public.UserRole.create({
            userId: user.id,
            roleId: userRole.id,
          });
        } else {
          const nameChanged = profile.name && profile.name !== user.name;
          const avatarChanged =
            profile.avatar && profile.avatar !== user.avatar;

          if (nameChanged || avatarChanged) {
            const updated = await tx.orm.public.User.where((u) =>
              u.id.eq(user!.id),
            ).update({
              ...(nameChanged ? { name: profile.name } : {}),
              ...(avatarChanged ? { avatar: profile.avatar } : {}),
            });
            if (!updated)
              throw new InternalServerErrorException(
                'User sync error after OAuth update',
              );
            user = updated;
          }
        }

        // 2. Find or upsert the OAuthAccount record
        const existingAccount = await tx.orm.public.OAuthAccount.where((a) =>
          a.provider.eq(profile.provider),
        )
          .where((a) => a.providerId.eq(profile.providerId))
          .first();

        if (existingAccount) {
          await tx.orm.public.OAuthAccount.where((a) =>
            a.id.eq(existingAccount.id),
          ).update({
            accessToken: profile.accessToken ?? null,
            refreshToken: profile.refreshToken ?? null,
            expiresAt,
          });
        } else {
          await tx.orm.public.OAuthAccount.create({
            provider: profile.provider,
            providerId: profile.providerId,
            accessToken: profile.accessToken ?? null,
            refreshToken: profile.refreshToken ?? null,
            expiresAt,
            userId: user.id,
          });
        }

        return user;
      });

      // 3. Sign and return JWT
      return this._buildAuthResult(user);
    } catch (error) {
      console.error('[AuthService] oauthLogin failed:', error);
      throw error;
    }
  }

  // ── Credentials sign-in ─────────────────────────────────────────────────────

  async signIn(email: string, password: string): Promise<AuthResult> {
    const user = await db.orm.public.User.where({ email }).first();

    if (!user) {
      // Use a generic message to avoid user-enumeration attacks
      throw new BadRequestException('Invalid email or password');
    }

    if (!user.password) {
      throw new BadRequestException(
        'This account was created via social login. Please sign in with Google or GitHub.',
      );
    }

    const isPasswordValid = await argon2.verify(user.password, password);
    if (!isPasswordValid) {
      throw new BadRequestException('Invalid email or password');
    }

    return this._buildAuthResult(user);
  }

  // ── Registration ────────────────────────────────────────────────────────────

  async signUp(
    dto: SignUpDto,
  ): Promise<{ message: string; data: Record<string, unknown> }> {
    const existing = await db.orm.public.User.where({
      email: dto.email,
    }).first();
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await argon2.hash(dto.password);
    const created = await db.transaction(async (tx) => {
      const userRole = await tx.orm.public.Role.where({ name: 'USER' }).first();
      if (!userRole) {
        throw new InternalServerErrorException(
          'The default USER role is not configured',
        );
      }

      const user = await tx.orm.public.User.create({
        email: dto.email,
        name: dto.name,
        username: dto.username ?? null,
        password: passwordHash,
      });
      await tx.orm.public.UserRole.create({
        userId: user.id,
        roleId: userRole.id,
      });
      return user;
    });

    const { password: _pw, ...safeUser } = created;
    return { message: 'Account created successfully', data: safeUser };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _buildAuthResult(
    user: Record<string, unknown> & {
      id: string;
      email: string;
      password?: string | null;
    },
  ): AuthResult {
    const payload = { sub: user.id, email: user.email };
    const { password: _pw, ...safeUser } = user;
    return {
      accessToken: this.jwtService.sign(payload),
      user: safeUser,
    };
  }
}
