import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  username: z.string().min(2).max(30).optional(),
  email: z.string().email({ message: 'Invalid email address' }),
  password: z
    .string()
    .min(6, { message: 'Password must be at least 6 characters' })
    .max(72, { message: 'Password must be at most 72 characters' }),
});

export const changePasswordSchema = z
  .object({
    oldPassword: z
      .string()
      .min(6, { message: 'Old password must be at least 6 characters' }),
    newPassword: z
      .string()
      .min(6, { message: 'New password must be at least 6 characters' })
      .max(72, { message: 'New password must be at most 72 characters' }),
    confirmNewPassword: z
      .string()
      .min(6, { message: 'Confirm password must be at least 6 characters' }),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'New passwords do not match',
    path: ['confirmNewPassword'],
  });

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  avatar: z.string().url({ message: 'Avatar must be a valid URL' }).optional(),
  username: z.string(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
