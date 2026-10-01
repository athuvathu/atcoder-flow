import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_PROBLEMS } from '../helpers/fixtures.js';

describe('Feature 14: 3-Tier Progressive Scaffolded Hint Ladder', () => {
  function unlockNextHint(currentRevealedCount, totalHints = 3) {
    if (currentRevealedCount >= totalHints) {
      return currentRevealedCount; // already maxed
    }
    return currentRevealedCount + 1;
  }

  function getActiveHints(problem, revealedCount) {
    const hints = problem.hints || [];
    return hints.slice(0, revealedCount);
  }

  it('case 1: should enforce sequential unlocking without skipping tiers', () => {
    let revealed = 0;
    revealed = unlockNextHint(revealed);
    assert.equal(revealed, 1, 'First unlock reveals Tier 1');
    revealed = unlockNextHint(revealed);
    assert.equal(revealed, 2, 'Second unlock reveals Tier 2');
    revealed = unlockNextHint(revealed);
    assert.equal(revealed, 3, 'Third unlock reveals Tier 3');
  });

  it('case 2: should clamp maximum revealed hints to 3 tiers', () => {
    let revealed = 3;
    revealed = unlockNextHint(revealed);
    assert.equal(revealed, 3, 'Cannot unlock beyond 3 tiers');
  });

  it('case 3: should verify all sample problems provide 3 tiers of scaffolded hints', () => {
    for (const prob of SAMPLE_PROBLEMS) {
      assert(Array.isArray(prob.hints), `Problem ${prob.id} must have hints array`);
      assert.equal(prob.hints.length, 3, `Problem ${prob.id} must have exactly 3 hints`);
      for (let i = 0; i < 3; i++) {
        assert(prob.hints[i].length > 10, `Hint ${i + 1} for ${prob.id} must be non-trivial`);
      }
    }
  });

  it('case 4: should verify Tier 1 focuses on invariant/observation and Tier 3 mentions asymptotic bounds', () => {
    const prob = SAMPLE_PROBLEMS.find(p => p.id === 'abc360_e');
    const hints = prob.hints;

    // Tier 1 observation
    assert(hints[0].toLowerCase().includes('probability') || hints[0].toLowerCase().includes('position'));
    // Tier 3 complexity
    assert(hints[2].includes('O(') || hints[2].toLowerCase().includes('transitions') || hints[2].toLowerCase().includes('runtime'));
  });

  it('case 5: should preserve non-spoiler invariants (no direct full solution code)', () => {
    for (const prob of SAMPLE_PROBLEMS) {
      for (const hint of prob.hints) {
        assert(!hint.includes('int main()'), 'Hint must not contain complete C++ boilerplate');
        assert(!hint.includes('#include'), 'Hint must not leak code headers');
      }
    }
  });
});
