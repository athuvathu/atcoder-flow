import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { atcoderToCodeforces, getAtcoderMeta, formatDualRatingHTML } from '../../public/rating.js';

describe('Unit: AtCoder to Codeforces Rating & Rank Conversion', () => {
  it('case 1: should correctly map benchmark anchors', () => {
    assert.equal(atcoderToCodeforces(0).cfRating, 600);
    assert.equal(atcoderToCodeforces(400).cfRating, 1050);
    assert.equal(atcoderToCodeforces(800).cfRating, 1380);
    assert.equal(atcoderToCodeforces(1200).cfRating, 1680);
    assert.equal(atcoderToCodeforces(1600).cfRating, 1950);
    assert.equal(atcoderToCodeforces(2000).cfRating, 2200);
    assert.equal(atcoderToCodeforces(2400).cfRating, 2450);
    assert.equal(atcoderToCodeforces(2800).cfRating, 2750);
    assert.equal(atcoderToCodeforces(3200).cfRating, 3100);
  });

  it('case 2: should interpolate strictly monotonically between anchors', () => {
    let lastCf = -Infinity;
    for (let at = 0; at <= 3500; at += 25) {
      const res = atcoderToCodeforces(at);
      assert.ok(res.cfRating >= lastCf, `Monotonicity violated at ${at}: ${res.cfRating} < ${lastCf}`);
      lastCf = res.cfRating;
    }
  });

  it('case 3: should assign correct Codeforces titles and colors', () => {
    // 600 -> Newbie
    const r600 = atcoderToCodeforces(0);
    assert.equal(r600.title, 'Newbie');

    // 1050 -> Newbie
    const r1050 = atcoderToCodeforces(400);
    assert.equal(r1050.title, 'Newbie');

    // 1380 -> Pupil
    const r1380 = atcoderToCodeforces(800);
    assert.equal(r1380.title, 'Pupil');

    // 1680 -> Expert
    const r1680 = atcoderToCodeforces(1200);
    assert.equal(r1680.title, 'Expert');
    assert.equal(r1680.color, '#4a90e2');

    // 1950 -> Candidate Master
    const r1950 = atcoderToCodeforces(1600);
    assert.equal(r1950.title, 'Candidate Master');
    assert.equal(r1950.color, '#ba55d3');

    // 2200 -> Master
    const r2200 = atcoderToCodeforces(2000);
    assert.equal(r2200.title, 'Master');

    // 2450 -> Grandmaster
    const r2450 = atcoderToCodeforces(2400);
    assert.equal(r2450.title, 'Grandmaster');
  });

  it('case 4: should format dual rating HTML string cleanly', () => {
    const html = formatDualRatingHTML(1200);
    assert.ok(html.includes('1200'), 'Should include AtCoder rating');
    assert.ok(html.includes('CF 1680 [Expert]'), 'Should include CF rating and title');
  });
});
