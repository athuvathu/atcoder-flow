import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clipDifficulty } from '../helpers/fixtures.js';

describe('Feature 6 & 17: Difficulty Clipping Model (Kenkoooo IRT Formula)', () => {
  it('case 1: should preserve difficulty values >= 400 exactly', () => {
    assert.equal(clipDifficulty(400), 400);
    assert.equal(clipDifficulty(1000), 1000);
    assert.equal(clipDifficulty(1249), 1249);
    assert.equal(clipDifficulty(2800), 2800);
    assert.equal(clipDifficulty(4200), 4200);
  });

  it('case 2: should correctly squash sub-400 positive difficulties using exponential formula', () => {
    // formula: round(400 / exp(1 - d / 400))
    // For d = 0: 400 / exp(1 - 0) = 400 / 2.71828... ~= 147.15 -> 147
    assert.equal(clipDifficulty(0), 147);
    // For d = 200: 400 / exp(0.5) ~= 242.6 -> 243
    assert.equal(clipDifficulty(200), 243);
    // For d = 399: 400 / exp(1/400) ~= 399
    assert.equal(clipDifficulty(399), 399);
  });

  it('case 3: should correctly compress negative difficulties (verified empirical targets)', () => {
    // Verified in spec_miner_kenkoooo:
    // -552 -> 37
    // -891 -> 16
    assert.equal(clipDifficulty(-552), 37);
    assert.equal(clipDifficulty(-891), 16);
  });

  it('case 4: should handle extreme negative difficulty bounds asymptotically converging to 0', () => {
    // For d = -10000: 400 / exp(26) -> 0
    assert.equal(clipDifficulty(-10000), 0);
    assert.equal(clipDifficulty(-50000), 0);
  });

  it('case 5: should handle null and undefined safely without throwing', () => {
    assert.equal(clipDifficulty(null), null);
    assert.equal(clipDifficulty(undefined), null);
  });
});
