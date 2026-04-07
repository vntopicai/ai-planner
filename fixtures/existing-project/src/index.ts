import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { marketRoutes } from './routes/market';

const app = new Elysia()
  .use(cors())
  .use(swagger())
  .use(marketRoutes)
  .get('/', () => ({
    message: 'Welcome to Vietnam Stock Market API!',
  }))
  .get('/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }))
  .listen(process.env.PORT || 3000);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
);

export type App = typeof app;
