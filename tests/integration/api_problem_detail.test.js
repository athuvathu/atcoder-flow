import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ensureServer, closeServer } from '../helpers/test_server.js';

describe('Integration: GET /api/problems/:id (Problem Detail & Scaffold Contract)', () => {
  let baseUrl;

  before(async () => {
    baseUrl = await ensureServer();
  });

  after(async () => {
    await closeServer();
  });

  it('case 1: should return full problem details for a valid problem ID (abc360_e)', async () => {
    const res = await fetch(`${baseUrl}/api/problems/abc360_e`);
    assert.equal(res.status, 200);
    const prob = await res.json();
    assert.equal(prob.id, 'abc360_e');
    assert.equal(prob.contest_id, 'abc360');
    assert.equal(prob.difficulty, 1249);
    assert.equal(prob.clipped_difficulty, 1249);
    assert.equal(prob.category, 'dp');
  });

  it('case 2: should return 3 scaffolded progressive hints in problem detail payload', async () => {
    const res = await fetch(`${baseUrl}/api/problems/abc360_e`);
    const prob = await res.json();
    assert(Array.isArray(prob.hints), 'Hints must be an array');
    assert.equal(prob.hints.length, 3);
    for (const h of prob.hints) {
      assert(typeof h === 'string' && h.length > 0);
    }
  });

  it('case 3: should return sample test cases with input and output fields', async () => {
    const res = await fetch(`${baseUrl}/api/problems/abc360_e`);
    const prob = await res.json();
    assert(Array.isArray(prob.sample_tests));
    assert(prob.sample_tests.length >= 2);
    for (const sample of prob.sample_tests) {
      assert('input' in sample);
      assert('output' in sample);
    }
  });

  it('case 4: should return HTTP 404 when querying an invalid/non-existent problem ID', async () => {
    const res = await fetch(`${baseUrl}/api/problems/non_existent_problem_xyz`);
    assert.equal(res.status, 404);
  });

  it('case 5: should return JSON error message on 404', async () => {
    const res = await fetch(`${baseUrl}/api/problems/non_existent_problem_xyz`);
    const json = await res.json();
    assert(json.error, 'Must contain error description');
  });
});
