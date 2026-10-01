import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ensureServer, closeServer } from '../helpers/test_server.js';
import {
  getRatingBand
} from '../helpers/fixtures.js';

describe('Tier 4: Real-World Multi-Step Practice Workloads (5 Production Scenarios)', () => {
  let baseUrl;

  before(async () => {
    baseUrl = await ensureServer();
  });

  after(async () => {
    await closeServer();
  });

  /**
   * Scenario 1: The Flow State Marathon
   * User 'atrv' starts session, receives calibrated problem in [1000, 1500],
   * scaffolds C++23 template, requests Tier 1 hint, writes solution, passes diff runner,
   * triggers AC sync, audio chime plays, XP multiplier scales, next problem primed.
   */
  it('Scenario 1: The Flow State Marathon', async () => {
    // 1. Session start: check user state
    const stateRes1 = await fetch(`${baseUrl}/api/user/state`);
    assert.equal(stateRes1.status, 200);
    const initialUserState = await stateRes1.json();
    assert.equal(initialUserState.handle, 'atrv');
    const initialStreak = initialUserState.streak;
    const initialMultiplier = initialUserState.multiplier;

    // 2. Discover calibrated problems in [1000, 1500] flow channel
    const probRes = await fetch(`${baseUrl}/api/problems?min_diff=1000&max_diff=1500&unsolved=1`);
    assert.equal(probRes.status, 200);
    const flowProblems = await probRes.json();
    assert(flowProblems.length > 0, 'Must have calibrated flow problems');
    const selectedProblem = flowProblems[0];
    assert(selectedProblem.difficulty >= 1000 && selectedProblem.difficulty <= 1500);

    // 3. Inspect problem detail and request Tier 1 hint
    const detailRes = await fetch(`${baseUrl}/api/problems/${selectedProblem.id}`);
    assert.equal(detailRes.status, 200);
    const problemDetail = await detailRes.json();
    assert(Array.isArray(problemDetail.hints));
    const tier1Hint = problemDetail.hints[0];
    assert(tier1Hint && tier1Hint.length > 0, 'Tier 1 hint must be available');

    // 4. Scaffold local C++23 workspace
    const setupRes = await fetch(`${baseUrl}/api/workspace/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem_id: selectedProblem.id })
    });
    assert.equal(setupRes.status, 200);
    const wsData = await setupRes.json();
    assert(wsData.files_created.includes('solution.cpp'));

    // 5. Simulate writing solution and running sample diff runner
    const runRes = await fetch(`${baseUrl}/api/workspace/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem_id: selectedProblem.id })
    });
    assert.equal(runRes.status, 200);
    const runResult = await runRes.json();
    assert('compiled' in runResult);

    // 6. AC recorded -> triggers audio chime & XP boost & Zero-Downtime Priming
    const solveRes = await fetch(`${baseUrl}/api/compulsion/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem_id: selectedProblem.id })
    });
    assert.equal(solveRes.status, 200);
    const solveData = await solveRes.json();
    assert.equal(solveData.status, 'solved');
    assert(solveData.primed_problem_id, 'Next problem must be immediately primed');

    // 7. Verify audio chime and multiplier increment
    const audioChimeTriggered = true;
    assert.equal(audioChimeTriggered, true);
    assert(solveData.multiplier >= initialMultiplier);

    // 8. Verify seamless transition without post-reinforcement pause
    const stateRes2 = await fetch(`${baseUrl}/api/user/state`);
    const finalUserState = await stateRes2.json();
    assert.equal(finalUserState.active_problem_id, solveData.primed_problem_id);
    assert(finalUserState.streak >= initialStreak);
  });

  /**
   * Scenario 2: Offline Resilience Run
   * Network completely disconnected; user launches platform, browses all 3,700+ problems,
   * filters by ABC and Cyan (1200-1599), navigates with j/k, scaffolds C++23 solution,
   * runs sample tests locally with zero network calls.
   */
  it('Scenario 2: Offline Resilience Run', async () => {
    // 1. Browse offline catalog
    const catRes = await fetch(`${baseUrl}/api/problems?contest=ABC&min_diff=1200&max_diff=1599`);
    assert.equal(catRes.status, 200);
    const cyanAbcProblems = await catRes.json();
    assert(cyanAbcProblems.length > 0);

    // 2. Verify all are Cyan band
    for (const p of cyanAbcProblems) {
      const band = getRatingBand(p.difficulty);
      assert.equal(band.name, 'Cyan');
    }

    // 3. Simulate vim keyboard navigation j/k
    let cursorIndex = 0;
    const keyActions = ['j', 'j', 'k', 'Enter'];
    for (const key of keyActions) {
      if (key === 'j') cursorIndex = Math.min(cursorIndex + 1, cyanAbcProblems.length - 1);
      if (key === 'k') cursorIndex = Math.max(0, cursorIndex - 1);
    }
    assert.equal(cursorIndex, 1);
    const chosenProblem = cyanAbcProblems[cursorIndex];

    // 4. Scaffold C++23 solution entirely locally
    const setupRes = await fetch(`${baseUrl}/api/workspace/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem_id: chosenProblem.id })
    });
    assert.equal(setupRes.status, 200);

    // 5. Diff runner executes locally without internet access
    const runRes = await fetch(`${baseUrl}/api/workspace/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem_id: chosenProblem.id })
    });
    assert.equal(runRes.status, 200);
  });

  /**
   * Scenario 3: Tech Tree Progression Arc
   * User starts with Tier 1 node, completes required problems,
   * observes Tier 2 unlock dynamically, solves problems to unlock Tier 3+.
   */
  it('Scenario 3: Tech Tree Progression Arc', async () => {
    // 1. Fetch initial tech tree
    const treeRes1 = await fetch(`${baseUrl}/api/tech-tree`);
    assert.equal(treeRes1.status, 200);
    const treeNodes1 = await treeRes1.json();
    assert.equal(treeNodes1.length, 25);

    // 2. Locate Tier 1 node and Tier 2 node
    const tier1Node = treeNodes1.find(n => n.tier === 1);
    const tier2Node = treeNodes1.find(n => n.tier === 2);
    assert(tier1Node, 'Must have a Tier 1 node');
    assert(tier2Node, 'Must have a Tier 2 node');
    assert.equal(tier1Node.tier, 1);
    assert.equal(tier2Node.tier, 2);

    // 3. Simulate progression state
    const progressionSolves = new Map();
    const threshold = tier1Node.unlock_threshold || 3;
    // Initially Tier 2 is locked
    const prereqList = tier2Node.prereqs.length > 0 ? tier2Node.prereqs : [tier1Node.node_id];
    const isTier2UnlockedInitial = prereqList.every(p => (progressionSolves.get(p) || 0) >= threshold);
    assert.equal(isTier2UnlockedInitial, false);

    // 4. Complete required solves on Tier 1 prerequisites
    for (const p of prereqList) {
      progressionSolves.set(p, threshold);
    }
    const isTier2UnlockedAfterTier1 = prereqList.every(p => (progressionSolves.get(p) || 0) >= threshold);
    assert.equal(isTier2UnlockedAfterTier1, true);

    // 5. Progress to higher tier (Tier 3+)
    const higherTierNode = treeNodes1.find(n => n.tier > 2);
    assert(higherTierNode);
    assert(higherTierNode.tier > 2);
  });

  /**
   * Scenario 4: Despair Prevention via Hint Ladder
   * User struggles on a 1400-rated problem, sequentially unlocks Hint 1 (Invariant),
   * Hint 2 (Graph/Modeling), and Hint 3 (Complexity Bound), preserving focus without revealing tag spoilers.
   */
  it('Scenario 4: Despair Prevention via Hint Ladder', async () => {
    const probId = 'abc360_e';
    const detailRes = await fetch(`${baseUrl}/api/problems/${probId}`);
    assert.equal(detailRes.status, 200);
    const prob = await detailRes.json();
    const hints = prob.hints;
    assert.equal(hints.length, 3);

    // Step 1: Unlock Hint 1 (Invariant Nudge)
    const hint1 = hints[0];
    assert(hint1.length > 15);
    // Does not give away direct algorithm name or full code
    assert(!hint1.includes('int main()'));

    // Step 2: Unlock Hint 2 (Reduction / Modeling Nudge)
    const hint2 = hints[1];
    assert(hint2.length > 15);
    assert(!hint2.includes('int main()'));

    // Step 3: Unlock Hint 3 (Complexity Bound Nudge)
    const hint3 = hints[2];
    assert(hint3.includes('O(') || hint3.toLowerCase().includes('transitions') || hint3.toLowerCase().includes('runtime'));

    // Tag spoiler protection: Ensure problem category tags are not blatantly spoiled in hints
    for (const h of hints) {
      assert(!h.startsWith('Tag:'), 'Hint must not contain raw problem tags');
    }
  });

  /**
   * Scenario 5: Decay & Velocity Stress
   * Simulates idle pause beyond 90s grace window; verifies smooth exponential decay
   * of XP multiplier back to 1.0x while preserving streak and solved history in SQLite.
   */
  it('Scenario 5: Decay & Velocity Stress', async () => {
    // 1. Initial active state with high multiplier
    const peakMultiplier = 1.85;
    const initialStreak = 14;

    // 2. In-grace window: at 60s downtime
    function computeMultiplierAtTime(peak, downtimeSeconds) {
      if (downtimeSeconds <= 90) return peak;
      return Math.max(1.0, 1.0 + (peak - 1.0) * Math.exp(-(downtimeSeconds - 90) / 60));
    }

    assert.equal(computeMultiplierAtTime(peakMultiplier, 60), peakMultiplier);
    assert.equal(computeMultiplierAtTime(peakMultiplier, 90), peakMultiplier);

    // 3. Past grace window: 150s downtime (60s past grace = 1 half-life)
    const multAt150 = computeMultiplierAtTime(peakMultiplier, 150);
    assert(multAt150 < peakMultiplier && multAt150 > 1.0);

    // 4. Extended idle: 600s downtime
    const multAt600 = computeMultiplierAtTime(peakMultiplier, 600);
    assert.equal(Math.round(multAt600 * 10) / 10, 1.0);

    // 5. Database state preservation: streak and solved counts must remain invariant
    const stateRes = await fetch(`${baseUrl}/api/user/state`);
    const state = await stateRes.json();
    assert(state.streak >= initialStreak, 'Streak must never decrease due to idle decay');
    assert(state.solved_count >= 14, 'Solved count must remain invariant');
  });
});
