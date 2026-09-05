import { z } from 'zod';

export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(255)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(32),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(255)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1),
});

export const patchMeSchema = z.object({
  displayName: z.string().trim().min(1).max(32),
});

export const startSessionSchema = z
  .object({
    gameId: z.string().uuid().optional(),
    gameSlug: z.string().trim().min(1).max(64).optional(),
  })
  .refine((value) => Boolean(value.gameId || value.gameSlug), {
    message: 'gameId or gameSlug is required',
  });

export const finishSessionSchema = z.object({
  score: z.number().finite(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export const leaderboardQuerySchema = z.object({
  period: z.enum(['all', 'weekly', 'daily']).default('all'),
});

export const gameIdOrSlugSchema = z.string().trim().min(1).max(80);
export const sessionIdSchema = z.string().uuid();
