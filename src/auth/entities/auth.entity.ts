import { ApiProperty } from '@nestjs/swagger';
import { UserEntity } from '../../user/entities/user.entity.js';

export class SignInResponseEntity {
  @ApiProperty({ example: 'Sign-in successful' })
  message: string;

  @ApiProperty({ type: () => UserEntity })
  user: UserEntity;
}

export class MessageResponseEntity {
  @ApiProperty({ example: 'Operation completed successfully' })
  message: string;
}

export class SignUpResponseEntity {
  @ApiProperty({ example: 'Account created successfully' })
  message: string;

  @ApiProperty({ type: () => UserEntity })
  data: UserEntity;
}
