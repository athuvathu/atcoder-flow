import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_PROBLEMS } from '../helpers/fixtures.js';

describe('Feature 13: Goldilocks 4% Challenge Calibration (1000 - 1500 Band)', () => {
  const USER_FLOW_CHANNEL = {
    handle: 'atrv',
    min_diff: 1000,
    max_diff: 1500,
    target_sweet_spot: 1300 // Kotler 4% above ~1250 baseline
  };

  function isInFlowChannel(problem, channel = USER_FLOW_CHANNEL) {
    if (problem.difficulty === null || problem.difficulty === undefined) return false;
    return problem.difficulty >= channel.min_diff && problem.difficulty <= channel.max_diff;
  }

  function scoreFlowSuitability(problem, channel = USER_FLOW_CHANNEL) {
    if (!isInFlowChannel(problem, channel)) return Infinity;
    // Lower score is better (closest to sweet spot)
    return Math.abs(problem.difficulty - channel.target_sweet_spot);
  }

  it('case 1: should correctly classify problems within the 1000-1500 flow channel', () => {
    for (const prob of SAMPLE_PROBLEMS) {
      assert(isInFlowChannel(prob), `Problem ${prob.id} (${prob.difficulty}) should be in flow channel`);
    }
  });

  it('case 2: should reject problems outside flow channel (too trivial or causing panic)', () => {
    const tooEasy = { id: 'abc100_a', difficulty: 450 };
    const tooHard = { id: 'abc100_f', difficulty: 2400 };

    assert.equal(isInFlowChannel(tooEasy), false);
    assert.equal(isInFlowChannel(tooHard), false);
  });

  it('case 3: should rank problem candidates by Kotler 4% sweet spot proximity', () => {
    const ranked = [...SAMPLE_PROBLEMS].sort((a, b) => scoreFlowSuitability(a) - scoreFlowSuitability(b));
    // Problem closest to 1300 is abc326_e (diff 1363, dist 63) or abc360_e (diff 1249, dist 51)
    assert.equal(ranked[0].id, 'abc360_e');
  });

  it('case 4: should handle edge boundaries of the 1000-1500 channel inclusively', () => {
    const lowerEdge = { id: 'test_low', difficulty: 1000 };
    const upperEdge = { id: 'test_high', difficulty: 1500 };

    assert.equal(isInFlowChannel(lowerEdge), true);
    assert.equal(isInFlowChannel(upperEdge), true);
  });

  it('case 5: should reject unrated or null difficulty problems from flow queue', () => {
    const unrated = { id: 'test_unrated', difficulty: null };
    assert.equal(isInFlowChannel(unrated), false);
  });
});
