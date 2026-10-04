/**
 * Codeforces Equivalent Rating & Rank Mapping Module
 * Calibrated against empirical AtCoder vs Codeforces rating regression curves.
 */

// Empirical CP calibration anchors: [AtCoder, Codeforces]
const ATCODER_TO_CF_MAP = [
  [-1000, 0],
  [0, 400],
  [400, 850],
  [800, 1200],
  [1200, 1500],
  [1600, 1800],
  [2000, 2050],
  [2400, 2300],
  [2800, 2600],
  [3200, 2900],
  [4000, 3700]
];

const CF_RANKS = [
  { min: 0, max: 1199, title: 'Newbie', color: '#9e9e9e' },
  { min: 1200, max: 1399, title: 'Pupil', color: '#5cb85c' },
  { min: 1400, max: 1599, title: 'Specialist', color: '#00d2d3' },
  { min: 1600, max: 1899, title: 'Expert', color: '#4a90e2' },
  { min: 1900, max: 2099, title: 'Candidate Master', color: '#ba55d3' },
  { min: 2100, max: 2299, title: 'Master', color: '#ff9f43' },
  { min: 2300, max: 2399, title: 'International Master', color: '#ff793f' },
  { min: 2400, max: 2599, title: 'Grandmaster', color: '#ff5252' },
  { min: 2600, max: 2999, title: 'International Grandmaster', color: '#ff3838' },
  { min: 3000, max: 9999, title: 'Legendary Grandmaster', color: '#ff1744' }
];

const ATCODER_BANDS = [
  { min: 0, max: 399, title: 'Gray', color: '#808080' },
  { min: 400, max: 799, title: 'Brown', color: '#c48b61' },
  { min: 800, max: 1199, title: 'Green', color: '#3faf3f' },
  { min: 1200, max: 1599, title: 'Cyan', color: '#42e0e0' },
  { min: 1600, max: 1999, title: 'Blue', color: '#5b8cff' },
  { min: 2000, max: 2399, title: 'Yellow', color: '#ffcc00' },
  { min: 2400, max: 2799, title: 'Orange', color: '#ff9436' },
  { min: 2800, max: 9999, title: 'Red', color: '#ff4d4d' }
];

/**
 * Converts an AtCoder rating / performance score to Codeforces equivalent.
 * Uses piecewise linear interpolation between empirical benchmarks.
 * 
 * @param {number} atcoderRating - AtCoder rating or performance score
 * @returns {{ cfRating: number, title: string, color: string, badge: string }}
 */
export function atcoderToCodeforces(atcoderRating) {
  const at = Number(atcoderRating) || 0;
  
  let cfRating = 600;
  
  if (at <= ATCODER_TO_CF_MAP[0][0]) {
    cfRating = ATCODER_TO_CF_MAP[0][1];
  } else if (at >= ATCODER_TO_CF_MAP[ATCODER_TO_CF_MAP.length - 1][0]) {
    const last = ATCODER_TO_CF_MAP[ATCODER_TO_CF_MAP.length - 1];
    cfRating = last[1] + (at - last[0]);
  } else {
    for (let i = 0; i < ATCODER_TO_CF_MAP.length - 1; i++) {
      const [atLow, cfLow] = ATCODER_TO_CF_MAP[i];
      const [atHigh, cfHigh] = ATCODER_TO_CF_MAP[i + 1];
      
      if (at >= atLow && at <= atHigh) {
        const t = (at - atLow) / (atHigh - atLow);
        cfRating = cfLow + t * (cfHigh - cfLow);
        break;
      }
    }
  }

  cfRating = Math.max(0, Math.round(cfRating));

  const rank = CF_RANKS.find(r => cfRating >= r.min && cfRating <= r.max) || CF_RANKS[CF_RANKS.length - 1];

  return {
    cfRating,
    title: rank.title,
    color: rank.color,
    badge: `CF ${cfRating} [${rank.title}]`
  };
}

/**
 * Returns AtCoder rating metadata (tier color and label).
 * 
 * @param {number} atcoderRating 
 * @returns {{ rating: number, title: string, color: string }}
 */
export function getAtcoderMeta(atcoderRating) {
  const at = Number(atcoderRating) || 0;
  const band = ATCODER_BANDS.find(b => at >= b.min && at <= b.max) || ATCODER_BANDS[0];
  return {
    rating: Math.round(at),
    title: band.title,
    color: band.color
  };
}

/**
 * Returns combined HTML badge string for dual AtCoder & Codeforces rating display.
 * 
 * @param {number} atcoderRating 
 * @returns {string} HTML markup
 */
export function formatDualRatingHTML(atcoderRating) {
  const atMeta = getAtcoderMeta(atcoderRating);
  const cfMeta = atcoderToCodeforces(atcoderRating);

  return `
    <span class="rating-combo">
      <span class="rating-at" style="color:${atMeta.color};">${atMeta.rating}</span>
      <span class="rating-sep">·</span>
      <span class="rating-cf" style="color:${cfMeta.color};" title="Codeforces equivalent">CF ${cfMeta.cfRating} [${cfMeta.title}]</span>
    </span>
  `.trim();
}
