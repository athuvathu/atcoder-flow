import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  initDb,
  closeDb,
  getTechTree,
  recomputeTechTree,
  getProblems,
  clipDifficulty,
  getUserState,
  updateUserState,
  markProblemSolved
} from '../../server/db.js';
import { handleRequest } from '../../server/routes.js';

describe('Tier 5 Adversarial: Algorithmic Tech Tree DAG & Progression', () => {
  beforeEach(() => {
    closeDb();
    initDb(':memory:');
  });

  afterEach(() => {
    closeDb();
  });

  it('DAG-1: Topological sort on all 25 nodes and prerequisite edges asserts zero cycles', () => {
    const nodes = getTechTree();
    assert.equal(nodes.length, 25, 'Tech tree must have exactly 25 nodes');

    const adj = new Map();
    const inDegree = new Map();
    nodes.forEach(n => {
      adj.set(n.node_id, []);
      inDegree.set(n.node_id, 0);
    });

    nodes.forEach(n => {
      for (const p of n.prereqs) {
        assert(adj.has(p), `Prerequisite "${p}" must be a registered node`);
        adj.get(p).push(n.node_id);
        inDegree.set(n.node_id, inDegree.get(n.node_id) + 1);
      }
    });

    const queue = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(id);
    }

    let visited = 0;
    while (queue.length > 0) {
      const curr = queue.shift();
      visited++;
      for (const nxt of adj.get(curr)) {
        inDegree.set(nxt, inDegree.get(nxt) - 1);
        if (inDegree.get(nxt) === 0) queue.push(nxt);
      }
    }

    assert.equal(visited, 25, 'Cycle detected: Topological sort failed to visit all 25 nodes');
  });

  it('DAG-2: Must contain exactly 5 distinct tiers with exactly 5 nodes per tier', () => {
    const nodes = getTechTree();
    const tierMap = new Map();
    for (const n of nodes) {
      assert(n.tier >= 1 && n.tier <= 5, `Invalid tier ${n.tier}`);
      tierMap.set(n.tier, (tierMap.get(n.tier) || 0) + 1);
    }
    assert.equal(tierMap.size, 5, 'Must have exactly 5 tiers');
    for (let t = 1; t <= 5; t++) {
      assert.equal(tierMap.get(t), 5, `Tier ${t} must have exactly 5 nodes`);
    }
  });

  it('DAG-3: Tier 2 nodes remain strictly locked until parent Tier 1 prerequisites are cleared', () => {
    const db = initDb();
    db.exec('UPDATE problems SET is_solved = 0;');
    recomputeTechTree(db);

    const nodes = getTechTree(db);
    const tier2Nodes = nodes.filter(n => n.tier === 2);
    assert.equal(tier2Nodes.length, 5);

    for (const n of tier2Nodes) {
      assert.equal(n.is_unlocked, false, `Node ${n.node_id} should be locked when prereqs have 0 solves`);
      assert.equal(n.status, 'locked', `Node ${n.node_id} status must be locked`);
    }
  });

  it('DAG-4 (Adversarial): Tech tree progression simulation across nodes when problems are solved', () => {
    const db = initDb();
    // Mark ALL 3,675 problems in the database as solved
    db.exec('UPDATE problems SET is_solved = 1;');
    recomputeTechTree(db);

    const nodes = getTechTree(db);
    const lockedNodes = nodes.filter(n => !n.is_unlocked);

    // CHALLENGE: If all problems are solved, every node in the tech tree should unlock.
    // However, due to category mismatch (problems store category 'sorting'/'graph' and sub_categories
    // like 'Two Pointers / Sliding Window', 'Prefix Sums', 'BFS / DFS'), recomputeTechTree ignores sub_category
    // and leaves 10 nodes permanently locked!
    assert.equal(
      lockedNodes.length,
      0,
      `Tech tree progression broken: ${lockedNodes.length} nodes remain locked even when ALL problems are solved! Permanently locked: ${lockedNodes.map(n => n.node_id).join(', ')}`
    );
  });
});

describe('Tier 5 Adversarial: Factorio Zero-Downtime Bottleneck Priming', () => {
  let server, baseUrl, db;

  beforeEach(async () => {
    closeDb();
    db = initDb(':memory:');
    server = http.createServer((req, res) => handleRequest(req, res));
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    if (server) await new Promise(r => server.close(r));
    closeDb();
  });

  it('PRIMING-1: POST /api/compulsion/solve immediately returns next optimal problem ID without PRP', async () => {
    const res = await fetch(`${baseUrl}/api/compulsion/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem_id: 'abc360_e' })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'solved');
    assert.equal(data.problem_id, 'abc360_e');
    assert(typeof data.primed_problem_id === 'string' && data.primed_problem_id.length > 0);
  });

  it('PRIMING-2 (Adversarial): Double-solve idempotency must not corrupt streak or multiplier', async () => {
    const problemId = 'abc360_e';

    // First solve
    const res1 = await fetch(`${baseUrl}/api/compulsion/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem_id: problemId })
    });
    const data1 = await res1.json();
    const streakAfterFirstSolve = data1.streak;
    const multAfterFirstSolve = data1.multiplier;

    // Second solve of the exact same problem ID (duplicate AC event or double-click)
    const res2 = await fetch(`${baseUrl}/api/compulsion/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem_id: problemId })
    });
    const data2 = await res2.json();

    // CHALLENGE: Second solve must be idempotent; streak and multiplier must NOT increase again!
    assert.equal(
      data2.streak,
      streakAfterFirstSolve,
      `Double-solve idempotency failure: streak corrupted from ${streakAfterFirstSolve} to ${data2.streak}`
    );
    assert.equal(
      data2.multiplier,
      multAfterFirstSolve,
      `Double-solve idempotency failure: multiplier corrupted from ${multAfterFirstSolve} to ${data2.multiplier}`
    );
  });

  it('PRIMING-3 (Adversarial): Solving a problem primes the next problem in the ACTIVE branch', async () => {
    // Problem abc360_e belongs to category 'dp'
    const res = await fetch(`${baseUrl}/api/compulsion/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem_id: 'abc360_e' })
    });
    const data = await res.json();
    const primedProb = db.prepare('SELECT category FROM problems WHERE id = ?').get(data.primed_problem_id);

    // CHALLENGE: Next problem primed must be in the active branch ('dp')
    assert.equal(
      primedProb?.category,
      'dp',
      `Active branch priming failure: solved problem in 'dp', but primed problem '${data.primed_problem_id}' is in category '${primedProb?.category}'`
    );
  });

  it('PRIMING-4 (Adversarial): Branch exhaustion must fall back to unmastered skill branch without returning solved problem', async () => {
    // Mark all flow-channel problems (1000-1500) as solved
    db.prepare('UPDATE problems SET is_solved = 1 WHERE difficulty BETWEEN 1000 AND 1500').run();

    const res = await fetch(`${baseUrl}/api/compulsion/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem_id: 'abc326_e' })
    });
    const data = await res.json();
    const primedProb = db.prepare('SELECT is_solved FROM problems WHERE id = ?').get(data.primed_problem_id);

    // CHALLENGE: Primed problem on fallback must NOT already be solved
    assert.equal(
      primedProb?.is_solved,
      0,
      `Branch exhaustion failure: fallback primed problem '${data.primed_problem_id}' is already solved!`
    );
  });
});

describe('Tier 5 Adversarial: Kotler 4% Flow Calibration & IRT Difficulty Clipping', () => {
  beforeEach(() => {
    closeDb();
    initDb(':memory:');
  });

  afterEach(() => {
    closeDb();
  });

  it('FLOW-1: Recommended problems fall strictly within user flow channel (1000 - 1500 rating)', () => {
    const flowProbs = getProblems({ min_diff: 1000, max_diff: 1500, unsolved: 1 });
    assert(flowProbs.length > 0, 'Must have problems in flow channel');
    for (const p of flowProbs) {
      assert(p.rating >= 1000 && p.rating <= 1500, `Problem ${p.id} rating ${p.rating} outside [1000, 1500]`);
    }
  });

  it('FLOW-2: IRT difficulty clipping squashes negative values exponentially (e.g. -891 -> 16)', () => {
    assert.equal(clipDifficulty(-891), 16, '-891 must clip to 16');
    assert.equal(clipDifficulty(-500), 42, '-500 must clip to 42');
    assert.equal(clipDifficulty(0), 147, '0 must clip to 147');
    assert.equal(clipDifficulty(400), 400, '400 must clip to 400');
    assert.equal(clipDifficulty(1249), 1249, '1249 must clip to 1249');
  });

  it('FLOW-3 (Adversarial): Problem filtering must not leak problems where neither raw nor clipped rating falls in range', () => {
    const db = initDb();
    // Boundary problem: raw difficulty = 350 (< 360), clipped = 369 (> 365)
    db.prepare(`
      INSERT INTO problems (id, contest_id, problem_index, title, difficulty, clipped_difficulty, category, hints_json, sample_tests_json, is_solved)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('test_boundary_leak', 'abc999', 'A', 'Boundary Leak', 350, 369, 'general', '[]', '[]', 0);

    const matches = getProblems({ min_diff: 360, max_diff: 365 }, db);
    const leaked = matches.find(p => p.id === 'test_boundary_leak');

    // CHALLENGE: SQL query uses disjoint OR: (difficulty >= 360 OR clipped >= 360) AND (difficulty <= 365 OR clipped <= 365)
    // This allows problems with diff=350 and clipped=369 to match [360, 365] even though NEITHER value is in [360, 365]!
    assert.equal(
      Boolean(leaked),
      false,
      'Query filter leak: problem with difficulty 350 and clipped 369 falsely returned for range [360, 365]'
    );
  });
});

describe('Tier 5 Adversarial: Compounding XP Multiplier & 90s Grace Decay', () => {
  let server, baseUrl, db;

  beforeEach(async () => {
    closeDb();
    db = initDb(':memory:');
    server = http.createServer((req, res) => handleRequest(req, res));
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    if (server) await new Promise(r => server.close(r));
    closeDb();
  });

  it('XP-1: Multiplier scales from baseline 1.0x up to 2.0x ceiling', () => {
    let mult = 1.0;
    for (let i = 0; i < 10; i++) {
      mult = Math.min(2.0, Math.round((mult + 0.15) * 100) / 100);
    }
    assert.equal(mult, 2.0, 'Multiplier must cap at 2.0x ceiling');
  });

  it('XP-2: Streak count is preserved during idle decay', async () => {
    updateUserState('atrv', { streak: 14, last_solve_epoch: Math.floor(Date.now() / 1000) - 86400 }, db);

    const res = await fetch(`${baseUrl}/api/user/state`);
    const state = await res.json();
    assert.equal(state.streak, 14, 'Streak must be preserved regardless of idle downtime');
  });

  it('XP-3 (Adversarial): Backend GET /api/user/state must reflect decayed multiplier after 90s grace window', async () => {
    // Simulate user reached peak multiplier 1.85, then went idle for 150 seconds (60s past grace)
    const now = Math.floor(Date.now() / 1000);
    updateUserState('atrv', { multiplier: 1.85, last_solve_epoch: now - 150 }, db);

    const res = await fetch(`${baseUrl}/api/user/state`);
    const state = await res.json();

    // CHALLENGE: At 150s (60s past 90s grace = 1 half-life of 60s), multiplier should have decayed:
    // 1.0 + (1.85 - 1.0) * exp(-60/60) = 1.0 + 0.85 * 0.3678 = 1.31x
    // If backend returns 1.85, decay is completely unimplemented on the server!
    assert(
      state.multiplier < 1.85,
      `Backend decay failure: multiplier returned ${state.multiplier} after 150s idle (expected decay from peak 1.85)`
    );
  });

  it('XP-4 (Adversarial): Solving after extended idle (24 hours) must not retain peak multiplier', async () => {
    const now = Math.floor(Date.now() / 1000);
    // User had 1.85 multiplier 24 hours ago
    updateUserState('atrv', { multiplier: 1.85, last_solve_epoch: now - 86400 }, db);

    const res = await fetch(`${baseUrl}/api/compulsion/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem_id: 'abc030_c' })
    });
    const data = await res.json();

    // CHALLENGE: After 24h idle, multiplier should have decayed to 1.0x baseline.
    // The new solve should give 1.0 + 0.15 = 1.15x.
    // However, backend computes user.multiplier + 0.15 = 1.85 + 0.15 = 2.0x!
    assert(
      data.multiplier <= 1.25,
      `Solve after downtime failure: multiplier jumped to ${data.multiplier} instead of building from decayed baseline (~1.15)`
    );
  });
});
