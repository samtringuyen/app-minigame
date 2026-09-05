import { buildApp } from './app.js';
import { connectRedis, closeRedis } from './cache/redis.js';
import { env } from './config/env.js';
import { closePool } from './db/pool.js';

const app = await buildApp();

await connectRedis();

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  try {
    await app.close();
    await closePool();
    await closeRedis();
  } finally {
    process.exit(0);
  }
};

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
