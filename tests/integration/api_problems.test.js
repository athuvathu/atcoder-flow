import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ensureServer, closeServer } from '../helpers/test_server.js';

describe('Integration: GET /api/problems (Catalog Query & Filtering)', () => {
  let baseUrl;

  before(async () => {
    baseUrl = await ensureServer();
  });

  after(async () => {
    await closeServer();
  });

  it('case 1: should return list of problems with status 200', async () => {
    const res = await fetch(`${baseUrl}/api/problems`);
    assert.equal(res.status, 200);
    const problems = await res.json();
    assert(Array.isArray(problems), 'Response must be an array of problems');
    assert(problems.length > 0, 'Catalog should not be empty');
  });

  it('case 2: should filter problems by contest prefix (e.g. ABC)', async () => {
    const res = await fetch(`${baseUrl}/api/problems?contest=ABC`);
    assert.equal(res.status, 200);
    const problems = await res.json();
    assert(problems.length > 0);
    for (const p of problems) {
      assert(p.contest_id.toUpperCase().startsWith('ABC'), `Contest ${p.contest_id} must start with ABC`);
    }
  });

  it('case 3: should filter problems within difficulty bounds [min_diff, max_diff]', async () => {
    const res = await fetch(`${baseUrl}/api/problems?min_diff=1200&max_diff=1400`);
    assert.equal(res.status, 200);
    const problems = await res.json();
    assert(problems.length > 0);
    for (const p of problems) {
      assert(p.difficulty >= 1200 && p.difficulty <= 1400, `Diff ${p.difficulty} not in [1200, 1400]`);
    }
  });

  it('case 4: should filter problems by algorithmic category (e.g. dp)', async () => {
    const res = await fetch(`${baseUrl}/api/problems?category=dp`);
    assert.equal(res.status, 200);
    const problems = await res.json();
    assert(problems.length > 0);
    for (const p of problems) {
      assert.equal(p.category, 'dp');
    }
  });

  it('case 5: should filter unsolved problems when unsolved_only=1 is requested', async () => {
    const res = await fetch(`${baseUrl}/api/problems?unsolved_only=1`);
    assert.equal(res.status, 200);
    const problems = await res.json();
    for (const p of problems) {
      assert(!p.is_solved, `Problem ${p.id} must be unsolved`);
    }
  });
});
