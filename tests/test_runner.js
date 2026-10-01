#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const TEST_SUITES = [
  // Unit Tests (Mathematical & Behavioral Models)
  { tier: 'Unit', name: 'Difficulty Clipping IRT', file: 'tests/unit/difficulty_clipping.test.js' },
  { tier: 'Unit', name: 'Rating Bands & Dot Fill', file: 'tests/unit/rating_bands.test.js' },
  { tier: 'Unit', name: 'Dark Theme & 40px Grid', file: 'tests/unit/dark_theme.test.js' },
  { tier: 'Unit', name: 'Table Layout & Blind Mode', file: 'tests/unit/table_layout.test.js' },
  { tier: 'Unit', name: 'Tech Tree DAG & Acyclicity', file: 'tests/unit/tech_tree_dag.test.js' },
  { tier: 'Unit', name: 'XP Multiplier & 90s Decay', file: 'tests/unit/xp_multiplier.test.js' },
  { tier: 'Unit', name: 'Goldilocks 4% Calibration', file: 'tests/unit/goldilocks_tuning.test.js' },
  { tier: 'Unit', name: '3-Tier Progressive Hints', file: 'tests/unit/hint_ladder.test.js' },
  { tier: 'Unit', name: 'Kenkoooo Sync & Polling', file: 'tests/unit/kenkoooo_sync.test.js' },
  { tier: 'Unit', name: 'Procedural Audio Parameters', file: 'tests/unit/audio_engine.test.js' },
  { tier: 'Unit', name: 'C++23 Boilerplate & Diff', file: 'tests/unit/cpp_workspace.test.js' },

  // Integration Tests (HTTP Endpoints & Database Persistence)
  { tier: 'Integration', name: 'GET /api/health Endpoint', file: 'tests/integration/api_health.test.js' },
  { tier: 'Integration', name: 'GET /api/problems Filtering', file: 'tests/integration/api_problems.test.js' },
  { tier: 'Integration', name: 'GET /api/problems/:id Details', file: 'tests/integration/api_problem_detail.test.js' },
  { tier: 'Integration', name: '/api/user/sync AC Detection', file: 'tests/integration/api_user_sync.test.js' },
  { tier: 'Integration', name: 'GET /api/user/state Flow Metrics', file: 'tests/integration/api_user_state.test.js' },
  { tier: 'Integration', name: 'GET /api/tech-tree 25 Nodes', file: 'tests/integration/api_tech_tree.test.js' },
  { tier: 'Integration', name: 'C++23 Workspace & Diff Runner', file: 'tests/integration/api_workspace.test.js' },
  { tier: 'Integration', name: 'POST /api/compulsion/solve', file: 'tests/integration/api_compulsion.test.js' },

  // E2E Tests (Tiers 1-4 Verification Pyramid)
  { tier: 'Tier 1', name: 'Tier 1: Feature Equivalence (22x5)', file: 'tests/e2e/tier1_features.test.js' },
  { tier: 'Tier 2', name: 'Tier 2: Boundary & Corner Cases (22x5)', file: 'tests/e2e/tier2_boundaries.test.js' },
  { tier: 'Tier 3', name: 'Tier 3: Cross-Feature Pairwise (15x)', file: 'tests/e2e/tier3_pairwise.test.js' },
  { tier: 'Tier 4', name: 'Tier 4: Real-World Workloads (5 Scenarios)', file: 'tests/e2e/tier4_workloads.test.js' }
];

console.log('========================================================================');
console.log('   Adaptive AtCoder Practice Platform — Master Test Orchestrator');
console.log('   Runtime: Node.js 22 LTS | node:test & node:assert/strict');
console.log('========================================================================\n');

const suiteResults = [];
let totalFailures = 0;
const overallStart = Date.now();

for (const suite of TEST_SUITES) {
  const filePath = path.join(PROJECT_ROOT, suite.file);
  const suiteStart = Date.now();

  process.stdout.write(`[RUNNING] ${suite.tier.padEnd(12)} | ${suite.name.padEnd(42)} ... `);

  const result = spawnSync('node', ['--test', filePath], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, FORCE_COLOR: '0' },
    encoding: 'utf-8'
  });

  const durationMs = Date.now() - suiteStart;
  const passed = result.status === 0;

  if (passed) {
    console.log(`[PASS] (${(durationMs / 1000).toFixed(2)}s)`);
  } else {
    console.log(`[FAIL] (${(durationMs / 1000).toFixed(2)}s)`);
    console.error(result.stderr || result.stdout);
    totalFailures++;
  }

  suiteResults.push({
    tier: suite.tier,
    name: suite.name,
    passed,
    durationMs
  });
}

const totalTime = ((Date.now() - overallStart) / 1000).toFixed(2);

console.log('\n========================================================================');
console.log('   4-Tier Verification Pyramid Execution Matrix');
console.log('========================================================================');
console.log(' Tier        | Suite Name                               | Status | Time    ');
console.log('-------------+------------------------------------------+--------+---------');

for (const res of suiteResults) {
  const statusStr = res.passed ? 'PASS  ' : 'FAIL  ';
  const timeStr = `${(res.durationMs / 1000).toFixed(2)}s`.padStart(7);
  console.log(` ${res.tier.padEnd(11)} | ${res.name.padEnd(40)} | ${statusStr} | ${timeStr}`);
}

console.log('========================================================================');
console.log(` Suites Tested: ${suiteResults.length} | Passed: ${suiteResults.length - totalFailures} | Failed: ${totalFailures} | Total Time: ${totalTime}s`);
console.log(' Coverage: Tier 1 (110) + Tier 2 (110) + Tier 3 (15) + Tier 4 (5) + Unit/Int (95)');
console.log(' Total Automated Verifications: > 335 Distinct Test Cases');
console.log('========================================================================');

if (totalFailures === 0) {
  console.log('>> OVERALL STATUS: ALL TEST SUITES PASSED (100% OPERATIONAL) <<\n');
  process.exit(0);
} else {
  console.error(`>> OVERALL STATUS: ${totalFailures} TEST SUITE(S) FAILED <<\n`);
  process.exit(1);
}
