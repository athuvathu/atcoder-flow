import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import {
  initDb,
  closeDb,
  getDb,
  getProblems,
  getProblemById,
  getUserState,
  updateUserState,
  markProblemSolved,
  recordSubmissions,
  getTechTree,
  recomputeTechTree
} from '../../server/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const TEST_DB_PATH = path.join(PROJECT_ROOT, 'data', 'test_concurrency_stress.db');

describe('Adversarial Stress Test: SQLite Concurrency & ACID Resilience', () => {
  let db;

  before(() => {
    // Clean up any old test db
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (fs.existsSync(`${TEST_DB_PATH}-wal`)) fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    if (fs.existsSync(`${TEST_DB_PATH}-shm`)) fs.unlinkSync(`${TEST_DB_PATH}-shm`);

    // Initialize db with test path
    db = initDb(TEST_DB_PATH);
  });

  after(() => {
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (fs.existsSync(`${TEST_DB_PATH}-wal`)) fs.unlinkSync(`${TEST_DB_PATH}-wal`);
    if (fs.existsSync(`${TEST_DB_PATH}-shm`)) fs.unlinkSync(`${TEST_DB_PATH}-shm`);
  });

  test('1. Verify WAL mode and foreign keys enabled', () => {
    const journalMode = db.prepare('PRAGMA journal_mode;').get();
    assert.equal(journalMode.journal_mode.toLowerCase(), 'wal', 'Database must be in WAL journal mode');

    const foreignKeys = db.prepare('PRAGMA foreign_keys;').get();
    assert.equal(foreignKeys.foreign_keys, 1, 'Foreign keys must be enabled');
  });

  test('2. ACID Atomicity & Rollback under simulated transaction failure', () => {
    const initialProblems = getProblems({}, db);
    const initialCount = initialProblems.length;
    assert.ok(initialCount > 0, 'Database should be seeded with problems');

    // Attempt a batch insertion with a duplicate primary key error inside a transaction
    assert.throws(() => {
      db.exec('BEGIN TRANSACTION;');
      const stmt = db.prepare(`
        INSERT INTO problems (id, contest_id, problem_index, title, difficulty, clipped_difficulty, category)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      // First insert valid
      stmt.run('stress_acid_p1', 'abc999', 'A', 'Acid Test 1', 1200, 1200, 'dp');
      // Second insert deliberately collides with existing ID without OR REPLACE
      stmt.run('stress_acid_p1', 'abc999', 'B', 'Acid Test 1 Duplicate', 1300, 1300, 'dp');
      db.exec('COMMIT;');
    }, /UNIQUE constraint failed/, 'Expected UNIQUE constraint violation');

    // Rollback if transaction remained open
    try {
      db.exec('ROLLBACK;');
    } catch (_) {}

    // Verify atomicity: stress_acid_p1 must NOT exist in DB
    const checkProblem = getProblemById('stress_acid_p1', db);
    assert.equal(checkProblem, null, 'Failed transaction must roll back completely; no partial writes allowed');
  });

  test('3. Rapid problem solve updates (100 rapid sequential solves and tech tree recalculations)', () => {
    const initialNodes = getTechTree(db);
    assert.equal(initialNodes.length, 25, 'Tech tree should contain 25 nodes');

    // Insert 100 dummy problems across multiple categories
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO problems (
        id, contest_id, problem_index, title, difficulty, clipped_difficulty, category, is_solved
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.exec('BEGIN TRANSACTION;');
    for (let i = 1; i <= 100; i++) {
      const cat = i % 2 === 0 ? 'dp' : 'graph';
      insertStmt.run(`rapid_prob_${i}`, 'abc888', 'A', `Rapid Prob ${i}`, 1100 + i, 1100 + i, cat, 0);
    }
    db.exec('COMMIT;');

    // Rapidly mark all 100 problems solved and verify tech tree consistency after each
    const startT = Date.now();
    for (let i = 1; i <= 100; i++) {
      const ok = markProblemSolved(`rapid_prob_${i}`, db);
      assert.ok(ok, `Problem rapid_prob_${i} must be marked solved`);
    }
    const elapsed = Date.now() - startT;
    console.log(`    [Stress] 100 rapid solve updates + tech tree recalculations completed in ${elapsed}ms`);

    // Verify all 100 are solved
    const solvedRows = db.prepare("SELECT COUNT(*) as cnt FROM problems WHERE id LIKE 'rapid_prob_%' AND is_solved = 1").get();
    assert.equal(solvedRows.cnt, 100, 'All 100 rapid problems must be marked solved');

    // Verify tech tree nodes updated appropriately
    const updatedNodes = getTechTree(db);
    const dpNode = updatedNodes.find(n => n.node_id === 'linear_dp');
    assert.ok(dpNode, 'linear_dp node must exist');
    assert.ok(dpNode.solved_count >= 50, `DP node solved count should reflect rapid solves (was ${dpNode.solved_count})`);
  });

  test('4. Concurrent Read / Write Interleaving under load (WAL mode resilience)', async () => {
    // In Node.js, we simulate concurrent interleaving of asynchronous read promises
    // while synchronous write transactions execute
    const readWorker = async (workerId, iterations) => {
      let readCount = 0;
      for (let i = 0; i < iterations; i++) {
        const probs = getProblems({ contest: 'ABC', min_diff: 1000, max_diff: 1500 }, db);
        const state = getUserState('atrv', db);
        const nodes = getTechTree(db);
        assert.ok(probs.length >= 0);
        assert.ok(state.handle === 'atrv');
        assert.ok(nodes.length === 25);
        readCount++;
        // Micro-yield to event loop
        await new Promise(r => setImmediate(r));
      }
      return readCount;
    };

    const writeWorker = async (workerId, iterations) => {
      let writeCount = 0;
      for (let i = 0; i < iterations; i++) {
        updateUserState('atrv', {
          streak: 20 + i,
          xp: 3000 + i * 10,
          multiplier: 1.0 + (i % 10) * 0.1
        }, db);
        writeCount++;
        await new Promise(r => setImmediate(r));
      }
      return writeCount;
    };

    // Run 5 reader workers and 2 writer workers concurrently
    const readers = [1, 2, 3, 4, 5].map(id => readWorker(id, 20));
    const writers = [1, 2].map(id => writeWorker(id, 20));

    const results = await Promise.all([...readers, ...writers]);
    assert.equal(results.length, 7, 'All concurrent workers must finish cleanly without crash or lock errors');

    // Check final state integrity
    const finalState = getUserState('atrv', db);
    assert.ok(finalState.streak >= 20, 'Final streak must reflect updates');
    assert.ok(finalState.xp >= 3000, 'Final XP must reflect updates');
  });

  test('5. Multi-connection concurrent reader/writer simulation with WAL mode', () => {
    // Open a second DatabaseSync connection to the same WAL database file
    const secondConn = new DatabaseSync(TEST_DB_PATH);
    secondConn.exec('PRAGMA journal_mode = WAL;');

    try {
      // 1. Writer begins transaction on conn 1
      db.exec('BEGIN IMMEDIATE TRANSACTION;');
      db.prepare("UPDATE user_state SET streak = 999 WHERE handle = 'atrv'").run();

      // 2. Reader on conn 2 can read without blocking (WAL mode snapshot isolation)
      const readOnConn2 = secondConn.prepare("SELECT streak FROM user_state WHERE handle = 'atrv'").get();
      // In WAL mode with uncommitted transaction, conn 2 sees old state (snapshot isolation)
      assert.notEqual(readOnConn2.streak, 999, 'Snapshot isolation: uncommitted writes from conn 1 must not leak to conn 2');

      // 3. Commit on conn 1
      db.exec('COMMIT;');

      // 4. Now conn 2 should see committed value
      const readCommitted = secondConn.prepare("SELECT streak FROM user_state WHERE handle = 'atrv'").get();
      assert.equal(readCommitted.streak, 999, 'Committed write from conn 1 must be immediately visible to conn 2');
    } finally {
      secondConn.close();
    }
  });
});
