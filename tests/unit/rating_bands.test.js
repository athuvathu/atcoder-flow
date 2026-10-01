import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getRatingBand, calculateDotFill, RATING_BANDS } from '../helpers/fixtures.js';

describe('Feature 4: Discrete Rating Dots & 400-Point Bands', () => {
  it('case 1: should correctly map rating boundaries across all 400-point bands', () => {
    assert.equal(getRatingBand(399).name, 'Gray');
    assert.equal(getRatingBand(400).name, 'Brown');
    assert.equal(getRatingBand(799).name, 'Brown');
    assert.equal(getRatingBand(800).name, 'Green');
    assert.equal(getRatingBand(1199).name, 'Green');
    assert.equal(getRatingBand(1200).name, 'Cyan');
    assert.equal(getRatingBand(1599).name, 'Cyan');
    assert.equal(getRatingBand(1600).name, 'Blue');
    assert.equal(getRatingBand(1999).name, 'Blue');
    assert.equal(getRatingBand(2000).name, 'Yellow');
    assert.equal(getRatingBand(2399).name, 'Yellow');
    assert.equal(getRatingBand(2400).name, 'Orange');
    assert.equal(getRatingBand(2799).name, 'Orange');
    assert.equal(getRatingBand(2800).name, 'Red');
    assert.equal(getRatingBand(3199).name, 'Red');
  });

  it('case 2: should identify metallic bands for Dan-tier ratings >= 3200', () => {
    const bronze = getRatingBand(3200);
    assert.equal(bronze.name, 'Bronze');
    assert.equal(bronze.metallic, true);

    const silver = getRatingBand(3600);
    assert.equal(silver.name, 'Silver');
    assert.equal(silver.metallic, true);

    const gold = getRatingBand(4000);
    assert.equal(gold.name, 'Gold');
    assert.equal(gold.metallic, true);
  });

  it('case 3: should accurately compute fill percentages within 400-point bands', () => {
    // 1200 is start of cyan band (0%)
    assert.equal(calculateDotFill(1200), 0);
    // 1300 is 100/400 (25%)
    assert.equal(calculateDotFill(1300), 25);
    // 1400 is 200/400 (50%)
    assert.equal(calculateDotFill(1400), 50);
    // 1500 is 300/400 (75%)
    assert.equal(calculateDotFill(1500), 75);
    // 1599 is 399/400 (100%)
    assert.equal(calculateDotFill(1599), 100);
  });

  it('case 4: should handle sub-zero difficulties by clipping before calculating fill', () => {
    // Negative difficulties clip to squashed sub-400 values in Gray band
    const fillNeg = calculateDotFill(-500);
    assert(fillNeg >= 0 && fillNeg <= 100, `Fill must be in [0, 100], got ${fillNeg}`);
    assert.equal(getRatingBand(-500).name, 'Gray');
  });

  it('case 5: should verify dark-mode hex codes match AtCoder Categories specifications', () => {
    const cyan = RATING_BANDS.find(b => b.name === 'Cyan');
    const green = RATING_BANDS.find(b => b.name === 'Green');
    const red = RATING_BANDS.find(b => b.name === 'Red');

    assert.equal(cyan.hex, '#42E0E0');
    assert.equal(green.hex, '#3FAF3F');
    assert.equal(red.hex, '#FF6767');
  });
});
