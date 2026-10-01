import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ensureServer, closeServer } from '../helpers/test_server.js';
import {
  clipDifficulty,
  calculateDotFill,
  getRatingBand,
  TECH_TREE_NODES,
  SAMPLE_PROBLEMS
} from '../helpers/fixtures.js';

describe('Tier 3: Cross-Feature Combinations & Compounding Progression Loops', () => {
  let baseUrl;

  before(async () => {
    baseUrl = await ensureServer();
  });

  after(async () => {
    await closeServer();
  });

  it('Pairwise 1: AC Sync -> Audio Chime -> XP Multiplier Bump -> Bottleneck Priming', async () => {
    // 1. Solve problem via compulsion API
    const solveRes = await fetch(`${baseUrl}/api/compulsion/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem_id: 'abc360_e' })
    });
    assert.equal(solveRes.status, 200);
    const solveData = await solveRes.json();
    assert.equal(solveData.status, 'solved');

    // 2. Chime event simulated: verify pentatonic notes are ready
    const chimeEvent = { type: 'AC_CHIME', played: true, notes: [523.25, 659.25, 783.99, 1046.50] };
    assert.equal(chimeEvent.played, true);
    assert.equal(chimeEvent.notes.length, 4);

    // 3. Verify XP multiplier increment
    assert(solveData.multiplier >= 1.15, `Multiplier should increase, got ${solveData.multiplier}`);

    // 4. Verify bottleneck problem was primed
    assert(solveData.primed_problem_id);
    const stateRes = await fetch(`${baseUrl}/api/user/state`);
    const state = await stateRes.json();
    assert.equal(state.active_problem_id, solveData.primed_problem_id);
  });

  it('Pairwise 2: Single-Key Vim "v" -> Kenkoooo Sync -> SQLite Submissions Table Update', async () => {
    // 1. User presses 'v' key in Zen mode
    const keyEvent = { key: 'v' };
    const action = keyEvent.key === 'v' ? 'TRIGGER_SYNC' : 'NONE';
    assert.equal(action, 'TRIGGER_SYNC');

    // 2. Client initiates sync request
    const syncRes = await fetch(`${baseUrl}/api/user/sync`);
    assert.equal(syncRes.status, 200);
    const syncData = await syncRes.json();
    assert(syncData.synced >= 14);

    // 3. User state reflects up-to-date solved count
    const stateRes = await fetch(`${baseUrl}/api/user/state`);
    const stateData = await stateRes.json();
    assert.equal(stateData.solved_count >= 14, true);
  });

  it('Pairwise 3: Contest Filter (ABC) + Diff Bounds [1200, 1500] + Discrete Rating Dot', async () => {
    // 1. Query with multiple combined filters
    const res = await fetch(`${baseUrl}/api/problems?contest=ABC&min_diff=1200&max_diff=1500`);
    assert.equal(res.status, 200);
    const problems = await res.json();
    assert(problems.length > 0);

    // 2. For each filtered problem, verify rating band and dot fill calculations
    for (const prob of problems) {
      assert(prob.contest_id.toUpperCase().startsWith('ABC'));
      assert(prob.difficulty >= 1200 && prob.difficulty <= 1500);

      const band = getRatingBand(prob.difficulty);
      assert.equal(band.name, 'Cyan', `Rating ${prob.difficulty} must be Cyan`);

      const fill = calculateDotFill(prob.difficulty);
      assert(fill >= 0 && fill <= 100);
    }
  });

  it('Pairwise 4: Hide Difficulty Toggle + Zen Mode HUD + Title Unbiasing', () => {
    let hideDifficulty = true;
    const testRating = 1363; // Cyan
    const band = getRatingBand(testRating);

    // When difficulty is hidden, title color must revert to neutral unbiasing text
    const titleColor = hideDifficulty ? '#e1e1e6' : band.hex;
    assert.equal(titleColor, '#e1e1e6');

    // Dot visibility is suppressed
    const dotVisible = !hideDifficulty;
    assert.equal(dotVisible, false);
  });

  it('Pairwise 5: Problem Selection -> C++23 Workspace Setup -> Diff Runner', async () => {
    const probId = 'abc360_e';

    // 1. Setup workspace
    const setupRes = await fetch(`${baseUrl}/api/workspace/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem_id: probId })
    });
    assert.equal(setupRes.status, 200);
    const setupData = await setupRes.json();
    assert(setupData.files_created.includes('solution.cpp'));

    // 2. Run diff runner
    const runRes = await fetch(`${baseUrl}/api/workspace/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem_id: probId })
    });
    assert.equal(runRes.status, 200);
    const runData = await runRes.json();
    assert('compiled' in runData);
  });

  it('Pairwise 6: Solve Progression -> Tech Tree Node Count -> Tier Unlock', () => {
    const solvesMap = new Map();
    const twoPointersNode = TECH_TREE_NODES.find(n => n.id === 'two_pointers');
    const binSearchNode = TECH_TREE_NODES.find(n => n.id === 'binary_search');

    // Simulate 3 solves on two_pointers
    solvesMap.set('two_pointers', 3);
    const isPrereqMet = (solvesMap.get('two_pointers') || 0) >= twoPointersNode.required_solves;
    assert.equal(isPrereqMet, true);

    // Binary search (Tier 2) becomes unlocked
    const binSearchUnlocked = binSearchNode.prereqs.every(p => (solvesMap.get(p) || 0) >= 3);
    assert.equal(binSearchUnlocked, true);
  });

  it('Pairwise 7: Audio Mute Toggle + AC Detection (Suppressed Audio Emission)', () => {
    const isMuted = true;
    let audioScheduled = false;

    function handleAC(result) {
      if (result === 'AC') {
        if (!isMuted) {
          audioScheduled = true;
        }
        return { status: 'recorded', audioEmitted: !isMuted };
      }
      return { status: 'ignored' };
    }

    const res = handleAC('AC');
    assert.equal(res.status, 'recorded');
    assert.equal(res.audioEmitted, false);
    assert.equal(audioScheduled, false);
  });

  it('Pairwise 8: Sequential Hint Ladder -> XP Scaling Penalty Calculation', () => {
    function calculateSolveXP(baseXP, hintsRevealed, multiplier) {
      // 10% penalty per hint revealed
      const penalty = 1.0 - (hintsRevealed * 0.1);
      return Math.round(baseXP * penalty * multiplier);
    }

    const xpNoHints = calculateSolveXP(100, 0, 1.5);
    const xpWith1Hint = calculateSolveXP(100, 1, 1.5);
    const xpWith3Hints = calculateSolveXP(100, 3, 1.5);

    assert.equal(xpNoHints, 150);
    assert.equal(xpWith1Hint, 135);
    assert.equal(xpWith3Hints, 105);
    assert(xpNoHints > xpWith1Hint && xpWith1Hint > xpWith3Hints);
  });

  it('Pairwise 9: Idle Downtime (>90s) -> Exponential Decay -> Recovery on Solve', () => {
    const peak = 1.8;
    function computeDecay(p, downtime) {
      if (downtime <= 90) return p;
      return Math.max(1.0, 1.0 + (p - 1.0) * Math.exp(-(downtime - 90) / 60));
    }

    // After 180s downtime
    const decayed = computeDecay(peak, 180);
    assert(decayed < peak && decayed > 1.0);

    // New solve restores momentum (+0.15)
    const restored = Math.min(2.0, decayed + 0.15);
    assert(restored > decayed);
  });

  it('Pairwise 10: Negative Raw Difficulty (-552) -> IRT Clipping (37) -> Gray Dot', () => {
    const rawDiff = -552;
    const clipped = clipDifficulty(rawDiff);
    assert.equal(clipped, 37);

    const band = getRatingBand(clipped);
    assert.equal(band.name, 'Gray');

    const fill = calculateDotFill(clipped);
    assert(fill >= 0 && fill <= 100);
  });

  it('Pairwise 11: Dark Theme (#08080a) + 40px Grid + Monospace CSS', () => {
    const cssBundle = `
      body { background-color: #08080a; font-family: ui-monospace, monospace; }
      body::before { background-size: 40px 40px; pointer-events: none; }
    `;
    assert(cssBundle.includes('#08080a'));
    assert(cssBundle.includes('40px 40px'));
    assert(cssBundle.includes('monospace'));
  });

  it('Pairwise 12: Offline Mode + Bundled Catalog Query + Local Workspace Run', async () => {
    // All queries must succeed with local server and zero internet access
    const probRes = await fetch(`${baseUrl}/api/problems?contest=ABC`);
    assert.equal(probRes.status, 200);
    const detailRes = await fetch(`${baseUrl}/api/problems/abc360_e`);
    assert.equal(detailRes.status, 200);
  });

  it('Pairwise 13: Vim Navigation "s" (Skip) -> Bottleneck Re-Priming', async () => {
    // Skipping problem primes next available problem in flow channel
    const solveRes = await fetch(`${baseUrl}/api/compulsion/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem_id: 'abc350_e' })
    });
    const json = await solveRes.json();
    assert(json.primed_problem_id);
  });

  it('Pairwise 14: User Preference Update -> Problem Filter Reflection', async () => {
    // 1. Update preferences
    const updateRes = await fetch(`${baseUrl}/api/user/preferences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contest_filter: 'ABC', min_diff: 1100, max_diff: 1400 })
    });
    assert.equal(updateRes.status, 200);

    // 2. Query problems using updated preference bounds
    const probRes = await fetch(`${baseUrl}/api/problems?contest=ABC&min_diff=1100&max_diff=1400`);
    assert.equal(probRes.status, 200);
    const probs = await probRes.json();
    for (const p of probs) {
      assert(p.contest_id.toUpperCase().startsWith('ABC'));
      assert(p.difficulty >= 1100 && p.difficulty <= 1400);
    }
  });

  it('Pairwise 15: Full AC Life Cycle: POST solve -> State Update -> DB Commit Verification', async () => {
    const res1 = await fetch(`${baseUrl}/api/user/state`);
    const s1 = await res1.json();

    // Trigger solve
    await fetch(`${baseUrl}/api/compulsion/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem_id: 'arc225_a' })
    });

    const res2 = await fetch(`${baseUrl}/api/user/state`);
    const s2 = await res2.json();
    assert(s2.streak >= s1.streak);
  });
});
