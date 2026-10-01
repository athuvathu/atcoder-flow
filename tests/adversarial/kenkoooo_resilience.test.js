import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDb, closeDb, getDb } from '../../server/db.js';
import { syncUserSubmissions } from '../../server/sync.js';
import { handleRequest } from '../../server/routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const TEST_DB_PATH = path.join(PROJECT_ROOT, 'data', 'test_sync_stress.db');

describe('Adversarial Stress Test: Kenkoooo Rate-Limiting & Offline Resilience', () => {
  let server;
  let baseUrl;
  let db;
  let originalFetch;

  before(async () => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (fs.existsSync(`${TEST_DB_PATH}-wal`)) fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    if (fs.existsSync(`${TEST_DB_PATH}-shm`)) fs.unlinkSync(`${TEST_DB_PATH}-shm`);

    db = initDb(TEST_DB_PATH);
    originalFetch = globalThis.fetch;

    server = http.createServer((req, res) => {
      handleRequest(req, res);
    });

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    globalThis.fetch = originalFetch;
    if (server) {
      server.closeAllConnections?.();
      server.closeIdleConnections?.();
      await new Promise((resolve) => server.close(resolve));
    }
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (fs.existsSync(`${TEST_DB_PATH}-wal`)) fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    if (fs.existsSync(`${TEST_DB_PATH}-shm`)) fs.unlinkSync(`${TEST_DB_PATH}-shm`);
  });

  test('1. Successive sequential sync calls strictly enforce >= 1000ms delay', async () => {
    const fetchTimestamps = [];

    // Mock fetch that records request timestamps and returns empty batch
    globalThis.fetch = async (url, options) => {
      fetchTimestamps.push(Date.now());
      return {
        ok: true,
        status: 200,
        json: async () => []
      };
    };

    const startT = Date.now();
    // Call sync 3 times sequentially
    const res1 = await syncUserSubmissions('atrv', db);
    const res2 = await syncUserSubmissions('atrv', db);
    const res3 = await syncUserSubmissions('atrv', db);
    const elapsed = Date.now() - startT;

    assert.equal(fetchTimestamps.length, 3, 'Fetch must be invoked 3 times');

    const gap1 = fetchTimestamps[1] - fetchTimestamps[0];
    const gap2 = fetchTimestamps[2] - fetchTimestamps[1];

    console.log(`    [Kenkoooo Rate-Limit] Gap 1->2: ${gap1}ms, Gap 2->3: ${gap2}ms (Elapsed: ${elapsed}ms)`);

    assert.ok(gap1 >= 990, `First gap should be >= 1000ms (got ${gap1}ms)`);
    assert.ok(gap2 >= 990, `Second gap should be >= 1000ms (got ${gap2}ms)`);
  });

  test('2. Offline simulated network failure falls back cleanly to local SQLite cache', async () => {
    // Simulate complete network disconnection for Kenkoooo API
    globalThis.fetch = async (url, opts) => {
      if (typeof url === 'string' && url.includes('kenkoooo.com')) {
        const err = new TypeError('Failed to fetch');
        err.cause = { code: 'ENOTFOUND' };
        throw err;
      }
      return originalFetch(url, opts);
    };

    // 1. Direct function call
    const directResult = await syncUserSubmissions('atrv', db);
    assert.equal(directResult.fallback_cache, true, 'Result must indicate fallback_cache is true');
    assert.ok(directResult.error.includes('Failed to fetch'), 'Error message must reflect the failure');
    assert.ok(directResult.synced >= 14, 'Synced count should fallback to local solved count');
    assert.ok(directResult.last_epoch > 0, 'Last epoch should fallback to local DB epoch');

    // 2. HTTP endpoint GET /api/user/sync
    const httpRes = await fetch(`${baseUrl}/api/user/sync?handle=atrv`);
    assert.equal(httpRes.status, 200, 'HTTP endpoint must return 200 OK during network outage (clean degradation)');
    const httpBody = await httpRes.json();
    assert.equal(httpBody.fallback_cache, true, 'HTTP body must show fallback_cache: true');
    assert.ok(httpBody.synced >= 14, 'HTTP body must return cached solve count');
  });

  test('3. Simulated Kenkoooo HTTP 500 / 429 rate limit error handling', async () => {
    // Simulate Kenkoooo returning 429 Too Many Requests
    globalThis.fetch = async (url, opts) => {
      if (typeof url === 'string' && url.includes('kenkoooo.com')) {
        return {
          ok: false,
          status: 429,
          statusText: 'Too Many Requests'
        };
      }
      return originalFetch(url, opts);
    };

    const result = await syncUserSubmissions('atrv', db);
    assert.equal(result.fallback_cache, true);
    assert.ok(result.error.includes('429'), 'Error message must report HTTP 429');
    assert.ok(result.synced >= 14, 'Local cache must be preserved');
  });

  test('4. Idempotency under duplicate submission ingestion', async () => {
    // Provide a mocked submission that already exists
    const mockSubmission = {
      id: 999901,
      epoch_second: 1782894238,
      problem_id: 'abc360_e',
      contest_id: 'abc360',
      user_id: 'atrv',
      language: 'C++ 23 (gcc 12.2)',
      point: 500,
      length: 1200,
      result: 'AC',
      execution_time: 15
    };

    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => [mockSubmission]
    });

    const firstRun = await syncUserSubmissions('atrv', db);
    assert.equal(firstRun.count, 1, 'First run should ingest 1 submission');

    // Second run with the same submission
    const secondRun = await syncUserSubmissions('atrv', db);
    assert.equal(secondRun.count, 1, 'Second run replaces duplicate row (idempotent)');

    // Verify row count in submissions table did not inflate
    const countRow = db.prepare("SELECT COUNT(*) as cnt FROM submissions WHERE id = 999901").get();
    assert.equal(countRow.cnt, 1, 'Submission ID must be stored exactly once');
  });

  test('5. Concurrent burst race condition inspection on rate limiter', async () => {
    const burstTimestamps = [];
    globalThis.fetch = async (url) => {
      burstTimestamps.push(Date.now());
      return {
        ok: true,
        status: 200,
        json: async () => []
      };
    };

    // Fire 2 sync requests concurrently at the exact same instant
    await Promise.all([
      syncUserSubmissions('atrv', db),
      syncUserSubmissions('atrv', db)
    ]);

    assert.equal(burstTimestamps.length, 2);
    const burstGap = Math.abs(burstTimestamps[1] - burstTimestamps[0]);
    console.log(`    [Kenkoooo Concurrent Burst] Gap between concurrent requests: ${burstGap}ms`);

    // In a naive rate limiter without a FIFO queue, concurrent requests wake up at the exact same time
    if (burstGap < 500) {
      console.warn(`    ⚠️ [VULNERABILITY DETECTED] Concurrent burst race: 2 concurrent calls sent within ${burstGap}ms! (Debounce queue missing FIFO serialization)`);
    }
  });
});
