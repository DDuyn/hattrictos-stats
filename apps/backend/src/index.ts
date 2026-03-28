import { env } from './config/env';
import { createApp } from './app';

const app = createApp();

const isDev = process.env.NODE_ENV !== 'production';
if (isDev) {
  console.log(`\x1b[36mServer running on http://localhost:${env.PORT}\x1b[0m`);
} else {
  process.stdout.write(
    JSON.stringify({
      level: 'info',
      timestamp: new Date().toISOString(),
      message: `Server running on port ${env.PORT}`,
    }) + '\n',
  );
}

export default {
  port: env.PORT,
  fetch: app.fetch,
};
