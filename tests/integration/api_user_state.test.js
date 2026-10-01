import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ensureServer, closeServer } from '../helpers/test_server.js';

describe('Integration: GET /api/user/state (Flow State, Streak & XP Multiplier)', () => {
  let baseUrl;

  before(async () => {
    baseUrl = await ensureServer();
  });

  after(async () => {
    await closeServer();
  });

  it('case 1: should return user state payload with handle "atrv"', async () => {
    const res = await fetch(`${baseUrl}/api/user/state`);
    assert.equal(res.status, 200);
    const state = await res.json();
    assert.equal(state.handle, 'atrv');
  });

  it('case 2: should return non-negative numeric streak tally', async () => {
    const res = await fetch(`${baseUrl}/api/user/state`);
    const state = await res.json();
    assert(typeof state.streak === 'number' && state.streak >= 0);
  });

  it('case 3: should return numeric XP points and active multiplier in [1.0, 2.0]', async () => {
    const res = await fetch(`${baseUrl}/api/user/state`);
    const state = await res.json();
    assert(typeof state.xp === 'number' && state.xp >= 0);
    assert(typeof state.multiplier === 'number');
    assert(state.multiplier >= 1.0 && state.multiplier <= 2.0, `Multiplier must be in [1.0, 2.0], got ${state.multiplier}`);
  });

  it('case 4: should return solved problem count matching solved submissions', async () => {
    const res = await fetch(`${baseUrl}/api/user/state`);
    const state = await res.json();
    assert(typeof state.solved_count === 'number');
    assert(state.solved_count >= 14, `Expected at least 14 solved problems, got ${state.solved_count}`);
  });

  it('case 5: should return active problem ID primed for the current flow session', async () => {
    const res = await fetch(`${baseUrl}/api/user/state`);
    const state = await res.json();
    assert(state.active_problem_id, 'Must contain active_problem_id');
    assert(typeof state.active_problem_id === 'string');
  });
});
