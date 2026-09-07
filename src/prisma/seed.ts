import 'dotenv/config';
import * as argon2 from 'argon2';
import { db } from './db.js';

type RoleName = 'ADMIN' | 'MANAGER' | 'USER';

type SeedUser = {
  email: string;
  username: string;
  name: string;
  role: RoleName;
  password: string;
};

const roles: Array<{ name: RoleName; description: string }> = [
  { name: 'ADMIN', description: 'Full access to the application' },
  { name: 'MANAGER', description: 'Access to management features' },
  { name: 'USER', description: 'Standard application access' },
];

const seedUsers: SeedUser[] = [
  {
    email: process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com',
    username: process.env.SEED_ADMIN_USERNAME ?? 'admin',
    name: 'Administrator',
    role: 'ADMIN',
    password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345',
  },
  {
    email: 'manager@example.com',
    username: 'manager',
    name: 'Demo Manager',
    role: 'MANAGER',
    password: 'Manager@12345',
  },
  {
    email: 'user@example.com',
    username: 'demo-user',
    name: 'Demo User',
    role: 'USER',
    password: 'User@12345',
  },
];

async function seed(): Promise<void> {
  await db.transaction(async (tx) => {
    const roleRecords = new Map<RoleName, { id: string }>();

    for (const role of roles) {
      const existing = await tx.orm.public.Role.where({
        name: role.name,
      }).first();
      const record = existing
        ? await tx.orm.public.Role.where({ name: role.name }).update({
            description: role.description,
            isActive: true,
          })
        : await tx.orm.public.Role.create(role);

      if (!record) {
        throw new Error(`Unable to seed role ${role.name}`);
      }
      roleRecords.set(role.name, record);
    }

    for (const seedUser of seedUsers) {
      const password = await argon2.hash(seedUser.password);
      const existing = await tx.orm.public.User.where({
        email: seedUser.email,
      }).first();
      const user = existing
        ? await tx.orm.public.User.where({ email: seedUser.email }).update({
            username: seedUser.username,
            name: seedUser.name,
            password,
          })
        : await tx.orm.public.User.create({
            email: seedUser.email,
            username: seedUser.username,
            name: seedUser.name,
            password,
          });

      if (!user) {
        throw new Error(`Unable to seed user ${seedUser.email}`);
      }

      const role = roleRecords.get(seedUser.role);
      if (!role) {
        throw new Error(`Unable to find seeded role ${seedUser.role}`);
      }

      const assignment = await tx.orm.public.UserRole.where({
        userId: user.id,
        roleId: role.id,
      }).first();
      if (!assignment) {
        await tx.orm.public.UserRole.create({
          userId: user.id,
          roleId: role.id,
        });
      }
    }
  });

  console.log('Seed completed.');
  console.log('Admin login:', seedUsers[0].email);
  console.log('Admin password:', seedUsers[0].password);
}

try {
  await seed();
} finally {
  await db.close();
}
