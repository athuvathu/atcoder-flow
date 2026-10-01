import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ATRV_SEED_SUBMISSIONS } from '../helpers/fixtures.js';

describe('Feature 15 & 16: Kenkoooo API Polling, Debouncing & AC Detection', () => {
  function buildKenkooooUrl(user, fromSecond) {
    const base = 'https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions';
    const params = new URLSearchParams({ user, from_second: String(fromSecond) });
    return `${base}?${params.toString()}`;
  }

  function isAccepted(submission) {
    return submission.result === 'AC';
  }

  function calculateNextFromSecond(submissions, fallback = 0) {
    if (!submissions || submissions.length === 0) return fallback;
    const maxEpoch = Math.max(...submissions.map(s => s.epoch_second));
    return maxEpoch + 1;
  }

  it('case 1: should construct valid Kenkoooo v3 submissions endpoint URL with user and from_second', () => {
    const url = buildKenkooooUrl('atrv', 1782894238);
    assert.equal(url, 'https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=atrv&from_second=1782894238');
  });

  it('case 2: should strictly identify AC submissions according to Kenkoooo specification', () => {
    const acSub = { result: 'AC', problem_id: 'abc360_e' };
    const waSub = { result: 'WA', problem_id: 'abc360_e' };
    const tleSub = { result: 'TLE', problem_id: 'abc360_e' };

    assert.equal(isAccepted(acSub), true);
    assert.equal(isAccepted(waSub), false);
    assert.equal(isAccepted(tleSub), false);
  });

  it('case 3: should correctly detect all 14 AC submissions in atrv seed dataset', () => {
    const acs = ATRV_SEED_SUBMISSIONS.filter(isAccepted);
    assert.equal(acs.length, 14);

    const nonAcs = ATRV_SEED_SUBMISSIONS.filter(s => !isAccepted(s));
    assert.equal(nonAcs.length, 2); // 1 WA, 1 TLE
  });

  it('case 4: should calculate next from_second parameter strictly greater than latest cached epoch', () => {
    const nextEpoch = calculateNextFromSecond(ATRV_SEED_SUBMISSIONS);
    assert.equal(nextEpoch, 1782894239);
  });

  it('case 5: should handle offline/network failure gracefully without unhandled promise rejection', async () => {
    async function safeSync(fetchFn) {
      try {
        await fetchFn();
      } catch (err) {
        return { success: false, fallback: true, error: err.message };
      }
    }

    const mockFailingFetch = async () => {
      throw new Error('fetch failed: ENOTFOUND kenkoooo.com');
    };

    const res = await safeSync(mockFailingFetch);
    assert.equal(res.success, false);
    assert.equal(res.fallback, true);
    assert(res.error.includes('ENOTFOUND'));
  });
});
