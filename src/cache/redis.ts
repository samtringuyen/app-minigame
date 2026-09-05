import { Redis } from 'ioredis';
import { env } from '../config/env.js';

export const redis = env.REDIS_URL
  ? new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    })
  : null;

export async function connectRedis(): Promise<void> {
  if (!redis) {
    return;
  }

  try {
    if (redis.status === 'wait') {
      await redis.connect();
    }
  } catch (error) {
    console.warn('Redis is unavailable; continuing without cache', error);
  }
}

export async function pingRedis(): Promise<'up' | 'down' | 'disabled'> {
  if (!redis) {
    return 'disabled';
  }

  try {
    const result = await redis.ping();
    return result === 'PONG' ? 'up' : 'down';
  } catch {
    return 'down';
  }
}

export async function closeRedis(): Promise<void> {
  if (!redis) {
    return;
  }

  try {
    redis.disconnect();
  } catch {
    // already closed
  }
}
