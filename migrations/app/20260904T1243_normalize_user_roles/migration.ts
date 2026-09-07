#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/2041834c9128a39b431e38a5fdd2e85b41413d6a8a55100176644c7255370956/contract';
import startContract from '../../snapshots/2041834c9128a39b431e38a5fdd2e85b41413d6a8a55100176644c7255370956/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/7017e511b9c0ccc8634e70a1e5f3207e76d9fa98729170672143a6fab87c6ec8/contract';
import endContract from '../../snapshots/7017e511b9c0ccc8634e70a1e5f3207e76d9fa98729170672143a6fab87c6ec8/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  col,
  fn,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({
        schema: 'public',
        table: 'users',
        constraint: 'users_role_id_fkey',
        kind: 'foreignKey',
      }),
      this.dropIndex({
        schema: 'public',
        table: 'users',
        index: 'users_role_id_idx_d9467c50',
      }),
      this.dropColumn({ schema: 'public', table: 'users', column: 'role_id' }),
      this.createTable({
        schema: 'public',
        table: 'user_roles',
        columns: [
          col('assigned_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('role_id', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('user_id', 'text', {
            notNull: true,
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [primaryKey(['user_id', 'role_id'])],
      }),
      this.createIndex({
        schema: 'public',
        table: 'user_roles',
        index: 'user_roles_role_id_idx_d9467c50',
        columns: ['role_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'user_roles',
        index: 'user_roles_user_id_idx_6c952402',
        columns: ['user_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'user_roles',
        foreignKey: {
          name: 'user_roles_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'user_roles',
        foreignKey: {
          name: 'user_roles_role_id_fkey',
          columns: ['role_id'],
          references: { schema: 'public', table: 'roles', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
