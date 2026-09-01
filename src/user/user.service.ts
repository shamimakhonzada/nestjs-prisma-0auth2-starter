import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { db } from '../prisma/db.js';
import * as argon2 from 'argon2';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';

@Injectable()
export class UserService {
  // ── Read ────────────────────────────────────────────────────────────────────

  async findAll(): Promise<Record<string, unknown>[]> {
    const users = await db.orm.public.User.all();
    return users.map(({ password: _pw, ...u }) => u);
  }

  async findOne(id: string): Promise<Record<string, unknown>> {
    const user = await db.orm.public.User.where({ id }).first();
    if (!user) throw new NotFoundException(`User with id "${id}" not found`);
    const { password: _pw, ...safeUser } = user;
    return safeUser;
  }

  // ── Write ───────────────────────────────────────────────────────────────────

  async update(
    requesterId: string,
    targetId: string,
    dto: UpdateUserDto,
  ): Promise<Record<string, unknown>> {
    // Users can only update themselves; admins can update anyone
    const requester = await db.orm.public.User.where({
      id: requesterId,
    }).first();
    if (!requester) throw new UnauthorizedException();

    const isAdmin = requester.role === 'ADMIN';
    if (!isAdmin && requesterId !== targetId) {
      throw new ForbiddenException('You can only update your own profile');
    }

    const target = await db.orm.public.User.where({ id: targetId }).first();
    if (!target)
      throw new NotFoundException(`User with id "${targetId}" not found`);

    await db.orm.public.User.where({ id: targetId }).update(dto);

    // Re-fetch to return fresh data without password
    const updated = await db.orm.public.User.where({ id: targetId }).first();
    const { password: _pw, ...safeUser } = updated!;
    return safeUser;
  }

  async remove(
    requesterId: string,
    targetId: string,
  ): Promise<{ message: string }> {
    const requester = await db.orm.public.User.where({
      id: requesterId,
    }).first();
    if (!requester) throw new UnauthorizedException();

    const isAdmin = requester.role === 'ADMIN';
    if (!isAdmin && requesterId !== targetId) {
      throw new ForbiddenException('You can only delete your own account');
    }

    const target = await db.orm.public.User.where({ id: targetId }).first();
    if (!target)
      throw new NotFoundException(`User with id "${targetId}" not found`);

    await db.orm.public.User.where({ id: targetId }).delete();
    return { message: 'User deleted successfully' };
  }

  async changePassword(
    requesterId: string,
    targetId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    // Users can only change their own password
    if (requesterId !== targetId) {
      throw new ForbiddenException('You can only change your own password');
    }

    if (dto.newPassword !== dto.confirmNewPassword) {
      throw new BadRequestException('New passwords do not match');
    }

    const user = await db.orm.public.User.where({ id: targetId }).first();
    if (!user) throw new NotFoundException('User not found');

    if (!user.password) {
      throw new BadRequestException(
        'This account uses social login and has no password set. Please use OAuth to sign in.',
      );
    }

    const isMatch = await argon2.verify(user.password, dto.oldPassword);
    if (!isMatch) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (dto.oldPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from the current password',
      );
    }

    const hash = await argon2.hash(dto.newPassword);
    await db.orm.public.User.where({ id: targetId }).update({ password: hash });

    return { message: 'Password changed successfully' };
  }
}
