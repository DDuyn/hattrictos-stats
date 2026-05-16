import { z } from 'zod';

export const userRoleSchema = z.enum(['owner', 'co_owner', 'admin']).nullable();

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
  role: userRoleSchema.optional(),
});

export const authResponseSchema = z.object({
  token: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string(),
    role: userRoleSchema,
    htTeamId: z.number().nullable(),
  }),
});

/** Input for admin-created users — no name, no password (generated server-side) */
export const createUserInputSchema = z.object({
  email: z.string().email(),
  role: userRoleSchema,
  htTeamId: z.number().int().positive().nullable().optional(),
});

/** Response includes the plain-text generated password so the admin can share it */
export const createUserResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string(),
    role: userRoleSchema,
    htTeamId: z.number().nullable(),
  }),
  generatedPassword: z.string(),
});

export const changePasswordInputSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

/** Input for admin updating a user's role and/or htTeamId */
export const updateUserInputSchema = z.object({
  role: userRoleSchema.optional(),
  htTeamId: z.number().int().positive().nullable().optional(),
});

export type LoginInput = z.infer<typeof loginInputSchema>;
export type RegisterInput = z.infer<typeof registerInputSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
export type CreateUserResponse = z.infer<typeof createUserResponseSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;
