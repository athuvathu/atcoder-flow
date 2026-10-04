import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { atcoderToCodeforces, getAtcoderMeta, formatDualRatingHTML } from '../../public/rating.js';

describe('Unit: AtCoder to Codeforces Rating & Rank Conversion', () => {
  it('case 1: should correctly map benchmark anchors', () => {
    assert.equal(atcoderToCodeforces(0).cfRating, 400);
    assert.equal(atcoderToCodeforces(400).cfRating, 850);
    assert.equal(atcoderToCodeforces(800).cfRating, 1200);
    assert.equal(atcoderToCodeforces(1200).cfRating, 1500);
    assert.equal(atcoderToCodeforces(1600).cfRating, 1800);
    assert.equal(atcoderToCodeforces(2000).cfRating, 2050);
    assert.equal(atcoderToCodeforces(2400).cfRating, 2300);
    assert.equal(atcoderToCodeforces(2800).cfRating, 2600);
    assert.equal(atcoderToCodeforces(3200).cfRating, 2900);
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
    // 400 -> Newbie
    const r0 = atcoderToCodeforces(0);
    assert.equal(r0.title, 'Newbie');

    // 850 -> Newbie
    const r400 = atcoderToCodeforces(400);
    assert.equal(r400.title, 'Newbie');

    // 1200 -> Pupil
    const r800 = atcoderToCodeforces(800);
    assert.equal(r800.title, 'Pupil');
    assert.equal(r800.color, '#5cb85c');

    // 1500 -> Specialist
    const r1200 = atcoderToCodeforces(1200);
    assert.equal(r1200.title, 'Specialist');
    assert.equal(r1200.color, '#00d2d3');

    // 1800 -> Expert
    const r1600 = atcoderToCodeforces(1600);
    assert.equal(r1600.title, 'Expert');
    assert.equal(r1600.color, '#4a90e2');

    // 2050 -> Candidate Master
    const r2000 = atcoderToCodeforces(2000);
    assert.equal(r2000.title, 'Candidate Master');
    assert.equal(r2000.color, '#ba55d3');

    // 2300 -> International Master
    const r2400 = atcoderToCodeforces(2400);
    assert.equal(r2400.title, 'International Master');

    // 2600 -> International Grandmaster
    const r2800 = atcoderToCodeforces(2800);
    assert.equal(r2800.title, 'International Grandmaster');
  });

  it('case 4: should format dual rating HTML string cleanly', () => {
    const html = formatDualRatingHTML(1200);
    assert.ok(html.includes('1200'), 'Should include AtCoder rating');
    assert.ok(html.includes('CF 1500 [Specialist]'), 'Should include CF rating and title');
  });
});
