import { ApiProperty } from '@nestjs/swagger';

export class UserEntity {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ example: 'johndoe', nullable: true })
  username?: string | null;

  @ApiProperty({ example: 'John Doe', nullable: true })
  name?: string | null;

  @ApiProperty({ example: 'https://example.com/avatar.jpg', nullable: true })
  avatar?: string | null;

  @ApiProperty({ example: 'USER', enum: ['USER', 'ADMIN'] })
  role: 'USER' | 'ADMIN';

  @ApiProperty({ example: '2026-09-01T10:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-09-01T10:00:00.000Z' })
  updatedAt: string;
}
