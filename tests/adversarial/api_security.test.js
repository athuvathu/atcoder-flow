import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDb, closeDb, getDb } from '../../server/db.js';
import { handleRequest } from '../../server/routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const TEST_DB_PATH = path.join(PROJECT_ROOT, 'data', 'test_security_stress.db');

describe('Adversarial Stress Test: API Security, Robustness & Injection Defenses', () => {
  let server;
  let baseUrl;
  let db;

  before(async () => {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (fs.existsSync(`${TEST_DB_PATH}-wal`)) fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    if (fs.existsSync(`${TEST_DB_PATH}-shm`)) fs.unlinkSync(`${TEST_DB_PATH}-shm`);

    db = initDb(TEST_DB_PATH);

    server = http.createServer((req, res) => {
      handleRequest(req, res);
    });

    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
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

  test('1. SQL Injection defense in GET /api/problems contest parameter', async () => {
    const maliciousPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE problems; --",
      "' UNION SELECT 'hack', 'hack', 'hack', 'hack', 'hack', 0, 0, 'hack', 'hack', '[]', '[]', 0 --",
      "ABC' OR 1=1 --",
      "\" OR \"\"=\"",
      "ABC'; SELECT pg_sleep(5); --"
    ];

    for (const payload of maliciousPayloads) {
      const url = `${baseUrl}/api/problems?contest=${encodeURIComponent(payload)}`;
      const res = await fetch(url);
      assert.equal(res.status, 200, `Endpoint should handle payload without crashing (got ${res.status})`);
      const body = await res.json();
      assert.ok(Array.isArray(body), 'Response should still be an array');
      // Payloads should safely return 0 matches because no contest matches the literal injection string
      assert.equal(body.length, 0, `SQL injection in contest '${payload}' must not leak or match any problem`);
    }

    // Verify problems table was not dropped
    const checkTable = db.prepare("SELECT COUNT(*) as count FROM problems").get();
    assert.ok(checkTable.count > 0, 'Problems table must remain intact');
  });

  test('2. SQL Injection defense in GET /api/problems min_diff and max_diff parameters', async () => {
    const payloads = [
      "1000' OR '1'='1",
      "1000; DROP TABLE problems; --",
      "1000 UNION SELECT 1",
      "NaN"
    ];

    for (const p of payloads) {
      const url = `${baseUrl}/api/problems?min_diff=${encodeURIComponent(p)}&max_diff=${encodeURIComponent(p)}`;
      const res = await fetch(url);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(Array.isArray(body), 'Response must be valid JSON array');
    }
  });

  test('3. SQL Injection and Path Traversal defense in GET /api/problems/:id', async () => {
    const attackIds = [
      "' OR '1'='1",
      "abc360_e' OR '1'='1",
      "'; DROP TABLE problems; --",
      "../../etc/passwd",
      "..%2f..%2fetc%2fpasswd",
      "abc360_e/../../secret"
    ];

    for (const id of attackIds) {
      const url = `${baseUrl}/api/problems/${encodeURIComponent(id)}`;
      const res = await fetch(url);
      // Valid IDs must match /^[a-zA-Z0-9_-]+$/; attacks should 404 or 400 safely
      assert.ok([400, 404].includes(res.status), `Attack ID '${id}' should return 400 or 404 (got ${res.status})`);
    }

    // Verify problems table is intact
    const checkTable = db.prepare("SELECT COUNT(*) as count FROM problems").get();
    assert.ok(checkTable.count > 0, 'Problems table must remain intact');
  });

  test('4. SQL Injection defense in POST /api/compulsion/solve', async () => {
    const attackPayloads = [
      { problem_id: "' OR '1'='1" },
      { problem_id: "'; DELETE FROM problems; --" },
      { problem_id: "abc360_e'; UPDATE user_state SET streak = 99999; --" }
    ];

    for (const payload of attackPayloads) {
      const res = await fetch(`${baseUrl}/api/compulsion/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      // Even if it accepts string, prepared statement parameterized update shouldn't match any row or corrupt DB
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'solved');
    }

    // Verify user state was not maliciously tampered by injected SQL
    const userState = db.prepare("SELECT streak FROM user_state WHERE handle = 'atrv'").get();
    assert.ok(userState.streak < 1000, `Streak must not be set to 99999 via SQLi (actual: ${userState.streak})`);
  });

  test('5. Malformed JSON payloads handled gracefully without server crash', async () => {
    const malformedBodies = [
      '{"problem_id": "abc360',             // Truncated JSON
      '{problem_id: 123}',                  // Unquoted keys
      '{"problem_id": undefined}',          // Invalid JSON token
      '<<<NOT_JSON>>>',                     // Random text
      '',                                   // Empty string
      'null',                               // JSON null
      '{"problem_id": '                    // Incomplete assignment
    ];

    for (const body of malformedBodies) {
      const res = await fetch(`${baseUrl}/api/workspace/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });
      // Should handle parse error and return 400 or error status, NEVER crash
      assert.ok([400, 500].includes(res.status), `Server should return 400/500 on malformed JSON (got ${res.status})`);
      const data = await res.json();
      assert.ok(data.error, 'Response must return error message');
    }

    // Server must still be responsive
    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200, 'Server must remain live and healthy after malformed JSON attacks');
  });

  test('6. Oversized request body rejection (>1MB DoS payload)', async () => {
    // Construct oversized 1.5MB JSON payload
    const largePadding = 'A'.repeat(1.5 * 1024 * 1024);
    const oversizedBody = JSON.stringify({
      problem_id: 'abc360_a',
      data: largePadding
    });

    let caughtError = false;
    try {
      const res = await fetch(`${baseUrl}/api/workspace/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: oversizedBody
      });
      // If server destroyed socket or returned 500
      if (!res.ok) caughtError = true;
    } catch (err) {
      // Socket destroy causes client fetch to throw ECONNRESET or socket hang up
      caughtError = true;
    }

    assert.ok(caughtError, 'Oversized payload (>1MB) must be rejected or aborted');

    // Verify server did not crash and is still accepting requests
    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200, 'Server must remain healthy after oversized payload');
  });

  test('7. Path traversal rejection in /api/workspace/setup and /api/workspace/run', async () => {
    const traversalPayloads = [
      '../../etc/passwd',
      '..\\..\\windows\\system32',
      '../../../data/atcoder_flow.db',
      'abc360_e/../../sensitive',
      'abc; rm -rf /',
      'abc`whoami`'
    ];

    for (const pid of traversalPayloads) {
      const resSetup = await fetch(`${baseUrl}/api/workspace/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem_id: pid })
      });
      assert.equal(resSetup.status, 400, `Workspace setup must reject traversal ID '${pid}' with 400`);

      const resRun = await fetch(`${baseUrl}/api/workspace/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem_id: pid })
      });
      assert.equal(resRun.status, 400, `Workspace run must reject traversal ID '${pid}' with 400`);
    }
  });
});
