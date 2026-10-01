import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ensureServer, closeServer } from '../helpers/test_server.js';

describe('Integration: /api/user/sync (Kenkoooo Sync & AC Detection)', () => {
  let baseUrl;

  before(async () => {
    baseUrl = await ensureServer();
  });

  after(async () => {
    await closeServer();
  });

  it('case 1: should trigger sync via GET /api/user/sync and return 200', async () => {
    const res = await fetch(`${baseUrl}/api/user/sync`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert('synced' in json);
    assert('new_ac' in json);
    assert('last_epoch' in json);
  });

  it('case 2: should trigger sync via POST /api/user/sync and return 200', async () => {
    const res = await fetch(`${baseUrl}/api/user/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: 'atrv' })
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert(json.synced >= 14, `Expected at least 14 synced ACs, got ${json.synced}`);
  });

  it('case 3: should return last_epoch as a positive integer timestamp', async () => {
    const res = await fetch(`${baseUrl}/api/user/sync`);
    const json = await res.json();
    assert(typeof json.last_epoch === 'number');
    assert(json.last_epoch > 1700000000);
  });

  it('case 4: should provide array of new_ac problem IDs', async () => {
    const res = await fetch(`${baseUrl}/api/user/sync`);
    const json = await res.json();
    assert(Array.isArray(json.new_ac));
  });

  it('case 5: should be idempotent on repeated sync calls without duplicate counts', async () => {
    const res1 = await fetch(`${baseUrl}/api/user/sync`);
    const json1 = await res1.json();
    const res2 = await fetch(`${baseUrl}/api/user/sync`);
    const json2 = await res2.json();

    assert.equal(json1.synced, json2.synced);
    assert.equal(json1.last_epoch, json2.last_epoch);
  });
});
