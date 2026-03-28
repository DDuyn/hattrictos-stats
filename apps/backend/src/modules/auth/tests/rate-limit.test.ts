import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import { createRateLimit } from '../../../middleware/rate-limit';

function createTestApp(windowMs: number, max: number) {
  const app = new Hono();
  app.use('/test', createRateLimit({ windowMs, max }));
  app.post('/test', (c) => c.json({ ok: true }));
  return app;
}

async function post(app: Hono, ip = '127.0.0.1') {
  return app.request('/test', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
  });
}

describe('createRateLimit middleware', () => {
  it('should allow requests below the limit', async () => {
    const app = createTestApp(60_000, 3);
    const res1 = await post(app);
    const res2 = await post(app);
    const res3 = await post(app);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res3.status).toBe(200);
  });

  it('should block the request that exceeds the limit', async () => {
    const app = createTestApp(60_000, 2);
    await post(app);
    await post(app);
    const res = await post(app);

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.code).toBe('RATE_LIMITED');
  });

  it('should include Retry-After header when blocked', async () => {
    const app = createTestApp(60_000, 1);
    await post(app);
    const res = await post(app);

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });

  it('should track limits per IP independently', async () => {
    const app = createTestApp(60_000, 1);
    await post(app, '1.2.3.4');
    const blocked = await post(app, '1.2.3.4');
    const allowed = await post(app, '5.6.7.8');

    expect(blocked.status).toBe(429);
    expect(allowed.status).toBe(200);
  });

  it('should reset the counter after the window expires', async () => {
    const app = createTestApp(50, 1); // ventana de 50ms
    await post(app);
    const blockedBefore = await post(app);
    expect(blockedBefore.status).toBe(429);

    await Bun.sleep(60); // esperar a que la ventana expire

    const allowedAfter = await post(app);
    expect(allowedAfter.status).toBe(200);
  });
});
