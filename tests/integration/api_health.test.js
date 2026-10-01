import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ensureServer, closeServer } from '../helpers/test_server.js';

describe('Integration: GET /api/health (Server Liveness Contract)', () => {
  let baseUrl;

  before(async () => {
    baseUrl = await ensureServer();
  });

  after(async () => {
    await closeServer();
  });

  it('case 1: should return HTTP 200 with status "ok"', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.status, 'ok');
  });

  it('case 2: should return application/json Content-Type header', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const ctype = res.headers.get('content-type');
    assert(ctype && ctype.includes('application/json'));
  });

  it('case 3: should return a valid recent timestamp (within 5 seconds of now)', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const json = await res.json();
    const now = Date.now();
    assert(Math.abs(now - json.timestamp) < 5000, `Timestamp ${json.timestamp} deviated from now ${now}`);
  });

  it('case 4: should return a non-negative server uptime in seconds', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const json = await res.json();
    assert(typeof json.uptime === 'number' && json.uptime >= 0);
  });

  it('case 5: should handle CORS preflight OPTIONS request on /api/health', async () => {
    const res = await fetch(`${baseUrl}/api/health`, { method: 'OPTIONS' });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
  });
});
