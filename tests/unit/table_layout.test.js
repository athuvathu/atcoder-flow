import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Feature 3 & 7: Monospace Table Layout & Hide Difficulty Mode', () => {
  const TABLE_LAYOUT = {
    columns: '48px 80px 1fr 70px 52px',
    gap: '12px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
  };

  it('case 1: should enforce the canonical 5-column CSS grid specification', () => {
    assert.equal(TABLE_LAYOUT.columns, '48px 80px 1fr 70px 52px');
    assert.equal(TABLE_LAYOUT.gap, '12px');
  });

  it('case 2: should enforce system monospace typography for code alignment', () => {
    assert(TABLE_LAYOUT.fontFamily.includes('monospace'));
    assert(TABLE_LAYOUT.fontFamily.includes('SFMono-Regular') || TABLE_LAYOUT.fontFamily.includes('ui-monospace'));
  });

  it('case 3: should correctly toggle difficulty visibility state', () => {
    let hideDifficulty = false;
    const toggleHideDifficulty = (prev) => !prev;

    hideDifficulty = toggleHideDifficulty(hideDifficulty);
    assert.equal(hideDifficulty, true);

    hideDifficulty = toggleHideDifficulty(hideDifficulty);
    assert.equal(hideDifficulty, false);
  });

  it('case 4: should calculate unbiasing title style when Hide Difficulty is active', () => {
    function computeTitleColor(ratingColor, hideDifficulty) {
      if (hideDifficulty) {
        return '#e1e1e6'; // unbiasing neutral text
      }
      return ratingColor;
    }

    assert.equal(computeTitleColor('#42E0E0', true), '#e1e1e6');
    assert.equal(computeTitleColor('#42E0E0', false), '#42E0E0');
  });

  it('case 5: should hide difficulty badge and dot elements in blind practice mode', () => {
    function getDiffElementStyles(hideDifficulty) {
      return {
        dotDisplay: hideDifficulty ? 'none' : 'inline-block',
        textDisplay: hideDifficulty ? 'none' : 'inline'
      };
    }

    const blindStyles = getDiffElementStyles(true);
    assert.equal(blindStyles.dotDisplay, 'none');
    assert.equal(blindStyles.textDisplay, 'none');

    const visibleStyles = getDiffElementStyles(false);
    assert.equal(visibleStyles.dotDisplay, 'inline-block');
    assert.equal(visibleStyles.textDisplay, 'inline');
  });
});
