import {
  BadRequestException,
  HttpStatus,
  Injectable,
  Response,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}
  async create(createUserDto: CreateUserDto) {
    try {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: createUserDto.email },
      });
      if (existingUser) {
        throw new Error(
          `User already exist with this ${createUserDto.email} email! `,
        );
      }
      if (!createUserDto.password) {
        throw new Error('Password is required');
      }
      const passwordHash = await bcrypt.hash(createUserDto.password, 10); // In production, hash the password before storing

      const createdUser = await this.prisma.user.create({
        data: { ...createUserDto, password: passwordHash },
      });

      return {
        status: HttpStatus.CREATED,
        success: true,
        message: 'User created.',
        data: createdUser,
      };
    } catch (error) {
      return {
        status: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
        success: false,
        message: 'Fail to create user!',
        error: error.message,
      };
    }
  }

  async findAll() {
    return this.prisma.user.findMany();
  }

  async findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    return this.prisma.user.update({ where: { id }, data: updateUserDto });
  }

  async remove(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }
  async changePassword(userId: string, passwordDto: ChangePasswordDto) {
    if (passwordDto.newPassword !== passwordDto.confirmNewPassword) {
      throw new BadRequestException('New passwords do not match');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    if (!user?.password) {
      throw new BadRequestException('No password set for this account');
    }

    const match = await bcrypt.compare(passwordDto.oldPassword, user.password);
    if (!match) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashPassword = await bcrypt.hash(passwordDto.newPassword, 12);
    return this.prisma.user.update({
      where: { id: userId },
      data: { password: hashPassword },
      select: { id: true, name: true, email: true },
    });
  }
}
