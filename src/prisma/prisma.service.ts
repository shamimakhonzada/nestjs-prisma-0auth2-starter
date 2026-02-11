import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private config: ConfigService) {
    const connectionString = config.get<string>('DATABASE_URL');

    if (!connectionString) {
      throw new Error(
        'DATABASE_URL is not defined in the environment variables.',
      );
    }

    const adapter = new PrismaPg({ connectionString });
    super({ adapter, omit: { user: { password: true } } }); // globally never return password
  }

  async onModuleInit() {
    // Explicitly connect when the module starts
    await this.$connect();
    console.log('Datebase Connected');
  }

  async onModuleDestroy() {
    // Gracefully disconnect when the application shuts down
    await this.$disconnect();
  }
}
