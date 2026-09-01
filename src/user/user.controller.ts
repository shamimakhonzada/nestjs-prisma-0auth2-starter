import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserService } from './user.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import {
  changePasswordSchema,
  updateUserSchema,
} from './schema/user.schema.js';

@ApiTags('Users')
@ApiBearerAuth('JWT')
@Controller('user')
@UseGuards(AuthGuard('jwt'))
export class UserController {
  constructor(private readonly userService: UserService) {}

  // ── Profile (self) ──────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile' })
  @Get('me')
  getMe(@Req() req: Request) {
    // req.user is already sanitized by JwtStrategy.validate() — no password exposed
    return req.user;
  }

  // ── Admin / read ─────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Get all users (admin use)' })
  @ApiResponse({
    status: 200,
    description: 'List of all users (passwords omitted)',
  })
  @Get()
  async findAll() {
    return this.userService.findAll();
  }

  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  // ── Mutations ───────────────────────────────────────────────────────────────

  @ApiOperation({ summary: 'Update a user profile' })
  @ApiResponse({ status: 200, description: 'User updated' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — can only update your own profile',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @Patch(':id')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body({ schema: updateUserSchema }) dto: UpdateUserDto,
  ) {
    const requesterId = (req.user as any).id as string;
    return this.userService.update(requesterId, id, dto);
  }

  @ApiOperation({ summary: 'Change password' })
  @ApiResponse({ status: 200, description: 'Password changed' })
  @ApiResponse({
    status: 400,
    description: 'Passwords do not match / same as old',
  })
  @ApiResponse({ status: 401, description: 'Current password is incorrect' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — can only change your own password',
  })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @Patch(':id/password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Req() req: Request,
    @Param('id') id: string,
    @Body({ schema: changePasswordSchema }) dto: ChangePasswordDto,
  ) {
    const requesterId = (req.user as any).id as string;
    return this.userService.changePassword(requesterId, id, dto);
  }

  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden — can only delete your own account',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Req() req: Request, @Param('id') id: string) {
    const requesterId = (req.user as any).id as string;
    return this.userService.remove(requesterId, id);
  }
}
