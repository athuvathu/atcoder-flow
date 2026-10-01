import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ensureServer, closeServer } from '../helpers/test_server.js';

describe('Integration: POST /api/compulsion/solve (Zero-Downtime Priming & Streak Multiplier)', () => {
  let baseUrl;
  const problemToSolve = 'abc360_e';

  before(async () => {
    baseUrl = await ensureServer();
  });

  after(async () => {
    await closeServer();
  });

  it('case 1: should mark problem as solved and return next primed problem', async () => {
    const res = await fetch(`${baseUrl}/api/compulsion/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem_id: problemToSolve })
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.status, 'solved');
    assert.equal(json.problem_id, problemToSolve);
    assert(json.primed_problem_id, 'Must prime next optimal problem');
  });

  it('case 2: should increment streak and update XP multiplier upon solve', async () => {
    const res = await fetch(`${baseUrl}/api/compulsion/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem_id: 'abc326_e' })
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert(json.streak >= 15);
    assert(json.multiplier >= 1.4);
  });

  it('case 3: should prime an unsolved problem in the target flow channel', async () => {
    const res = await fetch(`${baseUrl}/api/compulsion/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem_id: 'abc350_e' })
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert(typeof json.primed_problem_id === 'string');
    assert(json.primed_problem_id.length > 0);
  });

  it('case 4: should reject request with missing problem_id with HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/api/compulsion/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(res.status, 400);
  });

  it('case 5: should reflect updated state in subsequent GET /api/user/state query', async () => {
    const res = await fetch(`${baseUrl}/api/user/state`);
    assert.equal(res.status, 200);
    const state = await res.json();
    assert(state.streak > 14);
    assert(state.multiplier > 1.35);
  });
});
