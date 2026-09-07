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

type RoleName = 'ADMIN' | 'MANAGER' | 'USER';

@Injectable()
export class UserService {
  // ── Read ────────────────────────────────────────────────────────────────────

  async findAll(requesterId: string): Promise<Record<string, unknown>[]> {
    await this.assertAdmin(requesterId);
    const users = await db.orm.public.User.all();
    return users.map(({ password: _pw, ...u }) => u);
  }

  async findOne(
    requesterId: string,
    id: string,
  ): Promise<Record<string, unknown>> {
    if (requesterId !== id) await this.assertAdmin(requesterId);
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

    const isAdmin = await this.hasRole(requester.id, 'ADMIN');
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

    const isAdmin = await this.hasRole(requester.id, 'ADMIN');
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

  private async assertAdmin(userId: string): Promise<void> {
    if (!(await this.hasRole(userId, 'ADMIN'))) {
      throw new ForbiddenException('Administrator access is required');
    }
  }

  private async hasRole(userId: string, roleName: RoleName): Promise<boolean> {
    const role = await db.orm.public.Role.where({ name: roleName }).first();
    if (!role) return false;

    return Boolean(
      await db.orm.public.UserRole.where({ userId, roleId: role.id }).first(),
    );
  }
}
