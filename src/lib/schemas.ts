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

const levelIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9._-]+$/, 'levelId must be alphanumeric (dots, underscores, dashes allowed)');

export const startSessionSchema = z.object({
  gameId: z.string().uuid().optional(),
  gameSlug: z.string().trim().min(1).max(64).optional(),
  levelId: levelIdSchema,
});

export const finishSessionSchema = z
  .object({
    levelId: levelIdSchema,
    seed: z.string().trim().min(1).max(128),
    moves: z.number().int(),
    durationMs: z.number().int(),
    meta: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const leaderboardQuerySchema = z.object({
  period: z.enum(['all', 'weekly', 'daily']).default('all'),
  levelId: z.string().trim().min(1).max(64).optional(),
});

export const gameIdOrSlugSchema = z.string().trim().min(1).max(80);
export const sessionIdSchema = z.string().uuid();
