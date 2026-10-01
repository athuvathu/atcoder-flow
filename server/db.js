// SQLite Persistence Layer using native node:sqlite DatabaseSync
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_DB_PATH = path.join(PROJECT_ROOT, 'data', 'atcoder_flow.db');
const SCHEMA_PATH = path.join(PROJECT_ROOT, 'data', 'schema.sql');
const BUNDLED_PROBLEMS_PATH = path.join(PROJECT_ROOT, 'data', 'bundled_problems.json');

let dbInstance = null;

const CATEGORY_ALIASES = {
  'Dynamic Programming': 'dp',
  'dp': 'Dynamic Programming',
  'Graph Algorithms': 'graph',
  'graph': 'Graph Algorithms',
  'Number Theory': 'nt',
  'nt': 'Number Theory',
  'Greedy Algorithms': 'greedy',
  'greedy': 'Greedy Algorithms',
  'Sorting & Searching': 'sorting',
  'sorting': 'Sorting & Searching',
  'Range Queries': 'range',
  'range': 'Range Queries',
  'Prefix Sums': 'prefix_sum',
  'prefix_sum': 'Prefix Sums',
  'Two Pointers / Sliding Window': 'two_pointers',
  'two_pointers': 'Two Pointers / Sliding Window',
  'Binary Search': 'binary_search',
  'binary_search': 'Binary Search',
  'Bitwise Operations': 'bitwise',
  'bitwise': 'Bitwise Operations',
  'Combinatorics / Counting': 'counting',
  'counting': 'Combinatorics / Counting',
  'Probability / Expected Value': 'probability',
  'probability': 'Probability / Expected Value',
  'String Algorithms': 'strings',
  'strings': 'String Algorithms',
  'Game Theory': 'game_theory',
  'game_theory': 'Game Theory',
  'Geometry': 'geometry',
  'geometry': 'Geometry',
  'BFS / DFS': 'bfs_dfs',
  'bfs_dfs': 'BFS / DFS',
  'Dijkstra': 'dijkstra',
  'dijkstra': 'Dijkstra',
  'Segment Tree': 'segment_tree',
  'segment_tree': 'Segment Tree'
};

/**
 * Difficulty clipping formula:
 * clipDifficulty(d) = d >= 400 ? Math.round(d) : Math.round(400 / Math.exp(1 - d / 400))
 */
export function clipDifficulty(d) {
  if (d === null || d === undefined || isNaN(d)) return null;
  return d >= 400 ? Math.round(d) : Math.round(400 / Math.exp(1 - d / 400));
}

/**
 * Initializes and returns the SQLite database instance.
 */
export function initDb(dbPath = process.env.DB_PATH || DEFAULT_DB_PATH) {
  if (dbInstance) return dbInstance;

  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new DatabaseSync(dbPath);

  // WAL mode for high performance concurrent reads and writes
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = OFF;');

  // Run schema migration
  if (fs.existsSync(SCHEMA_PATH)) {
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
    db.exec(schemaSql);
  }

  // Ensure user_state has progression & session columns
  try {
    const cols = db.prepare("PRAGMA table_info(user_state)").all().map(c => c.name);
    if (!cols.includes('training_rating')) {
      db.exec('ALTER TABLE user_state ADD COLUMN training_rating REAL DEFAULT 1150;');
    }
    if (!cols.includes('session_paused')) {
      db.exec('ALTER TABLE user_state ADD COLUMN session_paused INTEGER DEFAULT 0;');
    }
    if (!cols.includes('session_elapsed_seconds')) {
      db.exec('ALTER TABLE user_state ADD COLUMN session_elapsed_seconds INTEGER DEFAULT 0;');
    }
    if (!cols.includes('session_solves')) {
      db.exec('ALTER TABLE user_state ADD COLUMN session_solves INTEGER DEFAULT 0;');
    }

    const subCols = db.prepare("PRAGMA table_info(submissions)").all().map(c => c.name);
    if (!subCols.includes('is_optimistic')) {
      db.exec('ALTER TABLE submissions ADD COLUMN is_optimistic INTEGER DEFAULT 0;');
    }
  } catch (err) {
    console.warn('[db] Migration notice:', err.message);
  }

  // Seed database if empty
  seedIfEmpty(db);

  dbInstance = db;
  return db;
}

/**
 * Returns current database instance, initializing if needed.
 */
export function getDb() {
  if (!dbInstance) {
    return initDb();
  }
  return dbInstance;
}

/**
 * Closes the active database connection.
 */
export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Seeds tables from bundled_problems.json and initial user state on first run if empty.
 */
export function seedIfEmpty(db) {
  const row = db.prepare('SELECT COUNT(*) as count FROM problems').get();
  if (row && row.count > 0) {
    return; // Already seeded
  }

  if (!fs.existsSync(BUNDLED_PROBLEMS_PATH)) {
    console.warn(`[db] Bundled problems file not found at ${BUNDLED_PROBLEMS_PATH}`);
    return;
  }

  console.log('[db] First run: seeding database from bundled_problems.json...');
  const rawData = fs.readFileSync(BUNDLED_PROBLEMS_PATH, 'utf8');
  const bundle = JSON.parse(rawData);

  const problems = Array.isArray(bundle) ? bundle : bundle.problems || [];
  const submissions = bundle.submissions || [];
  const techTree = bundle.tech_tree || [];
  const userState = bundle.user_state || {
    handle: 'atrv',
    streak: 14,
    xp: 2500,
    multiplier: 1.0,
    last_solve_epoch: 1790067015,
    active_problem_id: 'abc360_e',
    active_session_start: Math.floor(Date.now() / 1000)
  };
  const userPreferences = bundle.user_preferences || {
    handle: 'atrv',
    hide_difficulty: 0,
    contest_filter: 'ALL',
    min_diff: 1000,
    max_diff: 1500,
    muted: 0
  };

  db.exec('BEGIN TRANSACTION;');

  try {
    // 1. Seed problems
    const insertProblem = db.prepare(`
      INSERT OR REPLACE INTO problems (
        id, contest_id, problem_index, name, title, difficulty,
        clipped_difficulty, category, sub_category, hints_json, sample_tests_json, is_solved
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of problems) {
      const clipped = p.clipped_difficulty ?? clipDifficulty(p.difficulty);
      insertProblem.run(
        p.id,
        p.contest_id,
        p.problem_index,
        p.name || null,
        p.title,
        p.difficulty ?? null,
        clipped,
        p.category || 'general',
        p.sub_category || null,
        typeof p.hints_json === 'string' ? p.hints_json : JSON.stringify(p.hints_json || []),
        typeof p.sample_tests_json === 'string' ? p.sample_tests_json : JSON.stringify(p.sample_tests_json || []),
        p.is_solved ? 1 : 0
      );
    }

    // 2. Seed submissions
    const insertSubmission = db.prepare(`
      INSERT OR REPLACE INTO submissions (
        id, epoch_second, problem_id, contest_id, user_id, language, point, length, result, execution_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const s of submissions) {
      insertSubmission.run(
        s.id,
        s.epoch_second,
        s.problem_id,
        s.contest_id,
        s.user_id,
        s.language,
        s.point,
        s.length,
        s.result,
        s.execution_time ?? null
      );
    }

    // 3. Seed tech tree
    const insertTechNode = db.prepare(`
      INSERT OR REPLACE INTO tech_tree (
        node_id, title, tier, category, prereqs_json, unlock_threshold, solved_count, is_unlocked, is_mastered
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const node of techTree) {
      insertTechNode.run(
        node.node_id,
        node.title,
        node.tier,
        node.category,
        typeof node.prereqs_json === 'string' ? node.prereqs_json : JSON.stringify(node.prereqs_json || node.prereqs || []),
        node.unlock_threshold ?? 0,
        node.solved_count ?? 0,
        node.is_unlocked ?? (node.tier === 1 ? 1 : 0),
        node.is_mastered ?? 0
      );
    }

    // 4. Seed user state
    const insertUserState = db.prepare(`
      INSERT OR REPLACE INTO user_state (
        handle, streak, xp, multiplier, last_solve_epoch, active_problem_id, active_session_start
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertUserState.run(
      userState.handle,
      userState.streak ?? 14,
      userState.xp ?? 2500,
      userState.multiplier ?? 1.0,
      userState.last_solve_epoch ?? 1790067015,
      userState.active_problem_id || 'abc360_e',
      userState.active_session_start ?? Math.floor(Date.now() / 1000)
    );

    // 5. Seed user preferences
    const insertUserPrefs = db.prepare(`
      INSERT OR REPLACE INTO user_preferences (
        handle, hide_difficulty, contest_filter, min_diff, max_diff, muted
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertUserPrefs.run(
      userPreferences.handle,
      userPreferences.hide_difficulty ?? 0,
      userPreferences.contest_filter ?? 'ALL',
      userPreferences.min_diff ?? 1000,
      userPreferences.max_diff ?? 1500,
      userPreferences.muted ?? 0
    );

    db.exec('COMMIT;');
    console.log(`[db] Seeding completed: ${problems.length} problems, ${submissions.length} submissions, ${techTree.length} tech tree nodes.`);

    // Update tech tree unlocks based on initial solved status
    recomputeTechTree(db);
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('[db] Error seeding database:', err);
    throw err;
  }
}

/**
 * Queries problems with filtering.
 * Filters: contest (ABC/ARC/AGC/ALL), min_diff, max_diff, category, unsolved (1/0)
 */
export function getProblems(filters = {}, db = getDb()) {
  let query = 'SELECT * FROM problems WHERE 1=1';
  const params = [];

  // Contest filter
  const contest = (filters.contest || '').toUpperCase();
  if (contest && contest !== 'ALL') {
    query += ' AND UPPER(contest_id) LIKE ?';
    params.push(`${contest}%`);
  }

  // Difficulty range
  if (filters.min_diff !== undefined && filters.min_diff !== null && filters.min_diff !== '') {
    const minDiff = parseInt(filters.min_diff, 10);
    if (!isNaN(minDiff)) {
      query += ' AND (difficulty >= ? OR clipped_difficulty >= ?)';
      params.push(minDiff, minDiff);
    }
  }

  if (filters.max_diff !== undefined && filters.max_diff !== null && filters.max_diff !== '') {
    const maxDiff = parseInt(filters.max_diff, 10);
    if (!isNaN(maxDiff)) {
      query += ' AND (difficulty <= ? OR clipped_difficulty <= ?)';
      params.push(maxDiff, maxDiff);
    }
  }

  // Category filter
  if (filters.category && filters.category !== 'ALL') {
    const cat = filters.category;
    const alias = CATEGORY_ALIASES[cat];
    if (alias) {
      query += ' AND (category = ? OR category = ?)';
      params.push(cat, alias);
    } else {
      query += ' AND category = ?';
      params.push(cat);
    }
  }

  // Unsolved filter
  const unsolved = filters.unsolved ?? filters.unsolved_only;
  if (unsolved === '1' || unsolved === 1 || unsolved === true || unsolved === 'true') {
    query += ' AND is_solved = 0';
  }

  query += ' ORDER BY clipped_difficulty ASC, id ASC';

  const rows = db.prepare(query).all(...params);
  return rows.map(r => ({
    id: r.id,
    contest_id: r.contest_id,
    problem_index: r.problem_index,
    name: r.name,
    title: r.title,
    difficulty: r.difficulty,
    clipped_difficulty: r.clipped_difficulty,
    rating: r.clipped_difficulty,
    category: r.category,
    sub_category: r.sub_category,
    is_solved: r.is_solved // Keep integer 0/1 for exact assertions
  }));
}

/**
 * Queries single problem by ID with parsed JSON fields.
 */
export function getProblemById(id, db = getDb()) {
  const row = db.prepare('SELECT * FROM problems WHERE id = ?').get(id);
  if (!row) return null;

  let sampleTests = [];
  try {
    sampleTests = JSON.parse(row.sample_tests_json || '[]');
  } catch (e) {
    sampleTests = [];
  }

  // Filter out dummy placeholder test cases
  if (Array.isArray(sampleTests) && sampleTests.length > 0 && sampleTests[0]?.input === '1\n' && sampleTests[0]?.output === '1\n') {
    sampleTests = [];
  }

  const contest = row.contest_id || '';
  const problemUrl = `https://atcoder.jp/contests/${contest}/tasks/${row.id}`;
  const editorialUrl = `https://atcoder.jp/contests/${contest}/editorial`;
  const submissionsUrl = `https://atcoder.jp/contests/${contest}/submissions/me`;

  return {
    id: row.id,
    contest_id: row.contest_id,
    problem_index: row.problem_index,
    name: row.name,
    title: row.title,
    difficulty: row.difficulty,
    clipped_difficulty: row.clipped_difficulty,
    rating: row.clipped_difficulty,
    category: row.category,
    sub_category: row.sub_category,
    hints: [], // No fake generic hints!
    sample_tests: sampleTests,
    statement_html: row.statement_html || null,
    time_limit_ms: row.time_limit_ms || null,
    memory_limit_mb: row.memory_limit_mb || null,
    is_solved: row.is_solved === 1,
    url: problemUrl,
    editorial_url: editorialUrl,
    submissions_url: submissionsUrl
  };
}

/**
 * Saves scraped real problem statement and sample test cases.
 */
export function saveProblemScrapedDetails(problemId, details = {}, db = getDb()) {
  const { statement_html, time_limit_ms, memory_limit_mb, samples } = details;
  const samplesJson = Array.isArray(samples) ? JSON.stringify(samples) : null;

  const result = db.prepare(`
    UPDATE problems
    SET statement_html = COALESCE(?, statement_html),
        time_limit_ms = COALESCE(?, time_limit_ms),
        memory_limit_mb = COALESCE(?, memory_limit_mb),
        sample_tests_json = COALESCE(?, sample_tests_json)
    WHERE id = ?
  `).run(statement_html || null, time_limit_ms || null, memory_limit_mb || null, samplesJson, problemId);

  return result.changes > 0;
}

/**
 * Updates is_solved = 1 for a problem and recomputes tech tree.
 */
export function markProblemSolved(problemId, db = getDb()) {
  const result = db.prepare('UPDATE problems SET is_solved = 1 WHERE id = ?').run(problemId);
  recomputeTechTree(db);
  return result.changes > 0;
}

/**
 * Ingests new submissions into the database.
 * Detects AC results, updates problems.is_solved = 1, and updates user state.
 */
export function recordSubmissions(submissions, db = getDb()) {
  if (!submissions || submissions.length === 0) {
    return { inserted: 0, new_ac: [] };
  }

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO submissions (
      id, epoch_second, problem_id, contest_id, user_id, language, point, length, result, execution_time
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const markSolvedStmt = db.prepare(`
    UPDATE problems SET is_solved = 1 WHERE id = ?
  `);

  db.exec('BEGIN TRANSACTION;');
  let inserted = 0;
  const newAcProblemIds = [];

  try {
    for (const s of submissions) {
      insertStmt.run(
        s.id,
        s.epoch_second,
        s.problem_id,
        s.contest_id,
        s.user_id,
        s.language,
        s.point,
        s.length,
        s.result,
        s.execution_time ?? null
      );
      inserted++;

      if (s.result === 'AC') {
        const prob = db.prepare('SELECT is_solved FROM problems WHERE id = ?').get(s.problem_id);
        if (prob && prob.is_solved === 0) {
          markSolvedStmt.run(s.problem_id);
          newAcProblemIds.push(s.problem_id);
        }
      }
    }

    db.exec('COMMIT;');

    if (newAcProblemIds.length > 0) {
      recomputeTechTree(db);
    }

    return { inserted, new_ac: newAcProblemIds };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

/**
 * Automatically computes a user's empirical capability from their solved AC problems.
 * If user has >= 5 ACs, takes the 70th percentile of their solved problem difficulties.
 * If user has 1-4 ACs, takes the average.
 * If user has 0 ACs, defaults to user preferences or 1000.
 */
export function calculateUserBaselineRating(handle = 'atrv', db = getDb()) {
  try {
    const solvedRows = db.prepare(`
      SELECT p.clipped_difficulty as diff
      FROM problems p
      JOIN submissions s ON s.problem_id = p.id
      WHERE s.user_id = ? AND s.result = 'AC' AND p.clipped_difficulty IS NOT NULL
      GROUP BY p.id
      ORDER BY p.clipped_difficulty ASC
    `).all(handle);

    if (solvedRows.length >= 5) {
      const idx = Math.floor(solvedRows.length * 0.70);
      return Math.round(solvedRows[idx].diff);
    } else if (solvedRows.length > 0) {
      const sum = solvedRows.reduce((a, b) => a + b.diff, 0);
      return Math.round(sum / solvedRows.length);
    }
  } catch (_) {}

  const prefs = getUserPreferences(handle, db);
  return prefs.min_diff ? Math.round((prefs.min_diff + prefs.max_diff) / 2) : 1000;
}

/**
 * Calibrates realistic Par time in seconds based on problem difficulty.
 */
export function calculateParTime(difficulty) {
  const diff = difficulty || 1200;
  return Math.min(2100, Math.max(480, Math.round(600 + (diff - 1000) * 1.5)));
}

/**
 * Returns user state for handle, including live solved_count and adaptive training_rating.
 */
export function getUserState(handle = 'atrv', db = getDb()) {
  let row = db.prepare('SELECT * FROM user_state WHERE handle = ?').get(handle);
  const solvedCountRow = db.prepare("SELECT COUNT(DISTINCT problem_id) as count FROM submissions WHERE user_id = ? AND result = 'AC'").get(handle);
  const solvedCount = solvedCountRow?.count || 0;

  if (!row) {
    const baseline = calculateUserBaselineRating(handle, db);
    const initial = {
      handle,
      streak: 0,
      xp: 0,
      multiplier: 1.0,
      training_rating: baseline,
      session_paused: 0,
      session_elapsed_seconds: 0,
      session_solves: 0,
      last_solve_epoch: null,
      active_problem_id: null,
      active_session_start: Math.floor(Date.now() / 1000)
    };
    updateUserState(handle, initial, db);
    row = db.prepare('SELECT * FROM user_state WHERE handle = ?').get(handle);
  }

  let tr = row.training_rating;
  if (!tr || tr === 1150) {
    tr = calculateUserBaselineRating(handle, db);
  }

  return {
    handle: row.handle,
    streak: row.streak || 0,
    xp: row.xp || 0,
    multiplier: Math.max(1.0, Math.min(2.0, row.multiplier || 1.0)),
    training_rating: Math.round(tr),
    session_paused: row.session_paused || 0,
    session_elapsed_seconds: row.session_elapsed_seconds || 0,
    session_solves: row.session_solves || 0,
    solves_hour: 0.0,
    solved_count: solvedCount,
    last_solve_epoch: row.last_solve_epoch,
    active_problem_id: row.active_problem_id,
    active_session_start: row.active_session_start
  };
}

/**
 * Updates user state fields (streak, xp, multiplier, active_problem_id, etc.).
 */
export function updateUserState(handle = 'atrv', updates = {}, db = getDb()) {
  const current = getUserState(handle, db);
  const updated = { ...current, ...updates };

  db.prepare(`
    INSERT OR REPLACE INTO user_state (
      handle, streak, xp, multiplier, training_rating, session_paused,
      session_elapsed_seconds, session_solves, last_solve_epoch,
      active_problem_id, active_session_start
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    handle,
    updated.streak,
    updated.xp,
    updated.multiplier,
    updated.training_rating,
    updated.session_paused,
    updated.session_elapsed_seconds,
    updated.session_solves,
    updated.last_solve_epoch,
    updated.active_problem_id,
    updated.active_session_start
  );

  return updated;
}

/**
 * Adaptive flow recommendation: selects an unsolved problem matching user's training rating and mode.
 * Dynamically adjusts to user capability!
 */
export function getNextRecommendedProblem(handle = 'atrv', mode = 'flow', category = null, db = getDb()) {
  const user = getUserState(handle, db);
  const tr = user.training_rating || calculateUserBaselineRating(handle, db);

  let minDiff = tr - 50;
  let maxDiff = tr + 120;

  if (mode === 'speed' || mode === 'warmup') {
    minDiff = Math.max(0, tr - 250);
    maxDiff = Math.max(minDiff + 50, tr - 50);
  } else if (mode === 'reach' || mode === 'boss') {
    minDiff = tr + 120;
    maxDiff = tr + 350;
  }

  // Get last solved contest prefix to avoid repetition
  let lastContest = '';
  try {
    const lastSolved = db.prepare(`
      SELECT p.contest_id FROM submissions s
      JOIN problems p ON p.id = s.problem_id
      WHERE s.user_id = ? AND s.result = 'AC'
      ORDER BY s.epoch_second DESC LIMIT 1
    `).get(handle);
    lastContest = lastSolved?.contest_id || '';
  } catch (_) {}

  let sql = `
    SELECT id, contest_id, problem_index, name, title, difficulty, clipped_difficulty, category
    FROM problems
    WHERE is_solved = 0 AND clipped_difficulty BETWEEN ? AND ?
  `;
  const params = [minDiff, maxDiff];

  if (category && category !== 'ALL') {
    const alias = CATEGORY_ALIASES[category] || category;
    sql += ` AND (category = ? OR category = ?)`;
    params.push(category, alias);
  }

  const candidates = db.prepare(sql).all(...params);
  if (candidates.length > 0) {
    // Quality Filter: Prioritize modern Golden Era tasks (ABC 150+, ARC 100+, Educational DP)
    const isModernBanger = (c) => {
      const cid = (c.contest_id || '').toLowerCase();
      if (cid === 'dp') return true;
      if (cid.startsWith('abc')) {
        const num = parseInt(cid.slice(3), 10);
        return !isNaN(num) && num >= 150;
      }
      if (cid.startsWith('arc')) {
        const num = parseInt(cid.slice(3), 10);
        return !isNaN(num) && num >= 100;
      }
      return false;
    };

    const bangerPool = candidates.filter(isModernBanger);
    const chosenPool = bangerPool.length > 0 ? bangerPool : candidates;

    const nonRepeating = chosenPool.filter(c => c.contest_id !== lastContest);
    const pool = nonRepeating.length > 0 ? nonRepeating : chosenPool;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    return getProblemById(chosen.id, db);
  }

  // Fallback: broaden search around TR
  const fallback = db.prepare(`
    SELECT id FROM problems
    WHERE is_solved = 0
    ORDER BY ABS(clipped_difficulty - ?) ASC
    LIMIT 1
  `).get(tr);

  return fallback ? getProblemById(fallback.id, db) : null;
}

/**
 * Records an AC solve, calculates Par delta, adjusts dynamic rating, updates streak & multiplier,
 * and primes next problem in the flow channel.
 */
export function recordSolve(handle = 'atrv', problemId, elapsedSeconds = 0, isOptimistic = false, db = getDb()) {
  const problem = getProblemById(problemId, db);
  if (!problem) throw new Error(`Problem '${problemId}' not found in database`);

  if (problem.is_solved) {
    return { already_solved: true, problem };
  }

  db.prepare('UPDATE problems SET is_solved = 1 WHERE id = ?').run(problemId);

  const existingSub = db.prepare("SELECT id FROM submissions WHERE user_id = ? AND problem_id = ? AND result = 'AC' LIMIT 1").get(handle, problemId);
  if (!existingSub) {
    const subId = Date.now();
    db.prepare(`
      INSERT OR REPLACE INTO submissions (
        id, epoch_second, problem_id, contest_id, user_id, language, point, length, result, is_optimistic
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      subId,
      Math.floor(Date.now() / 1000),
      problemId,
      problem.contest_id,
      handle,
      'C++23',
      problem.difficulty || 0,
      1000,
      'AC',
      isOptimistic ? 1 : 0
    );
  }

  recomputeTechTree(db);

  const parTime = calculateParTime(problem.clipped_difficulty);
  const user = getUserState(handle, db);
  const currentTr = user.training_rating || calculateUserBaselineRating(handle, db);

  let ratingDelta = 0;
  if (elapsedSeconds > 0 && elapsedSeconds <= parTime * 0.6) {
    ratingDelta = +25;
  } else if (elapsedSeconds > 0 && elapsedSeconds <= parTime * 1.2) {
    ratingDelta = +12;
  } else {
    ratingDelta = +5;
  }

  const newTr = Math.max(400, Math.min(3200, currentTr + ratingDelta));
  const newStreak = user.streak + 1;
  const newMultiplier = Math.min(2.0, Math.round((user.multiplier + 0.15) * 100) / 100);
  const baseXP = Math.max(50, Math.round((problem.clipped_difficulty || 1000) / 10));
  const xpGain = Math.round(baseXP * newMultiplier);
  const newSessionSolves = (user.session_solves || 0) + 1;

  const nextProblem = getNextRecommendedProblem(handle, 'flow', null, db);

  updateUserState(handle, {
    streak: newStreak,
    xp: user.xp + xpGain,
    multiplier: newMultiplier,
    training_rating: newTr,
    session_solves: newSessionSolves,
    last_solve_epoch: Math.floor(Date.now() / 1000),
    active_problem_id: nextProblem?.id || null,
    session_elapsed_seconds: 0,
    session_paused: 0
  }, db);

  return {
    status: 'solved',
    problem_id: problemId,
    streak: newStreak,
    multiplier: newMultiplier,
    xp_gained: xpGain,
    training_rating: newTr,
    rating_delta: ratingDelta,
    par_seconds: parTime,
    elapsed_seconds: elapsedSeconds,
    is_optimistic: isOptimistic,
    primed_problem: nextProblem
  };
}

/**
 * Records a skip / abandon with user feedback and re-primes next problem.
 */
export function recordSkip(handle = 'atrv', problemId, reason = 'neutral', db = getDb()) {
  const user = getUserState(handle, db);
  const currentTr = user.training_rating || calculateUserBaselineRating(handle, db);

  let delta = -10;
  if (reason === 'too_hard') delta = -25;
  else if (reason === 'too_easy') delta = +25;

  const newTr = Math.max(400, Math.min(3200, currentTr + delta));
  const nextProblem = getNextRecommendedProblem(handle, 'flow', null, db);

  updateUserState(handle, {
    training_rating: newTr,
    active_problem_id: nextProblem?.id || null,
    session_elapsed_seconds: 0,
    session_paused: 0
  }, db);

  return {
    status: 'skipped',
    reason,
    previous_tr: currentTr,
    new_tr: newTr,
    delta,
    primed_problem: nextProblem
  };
}

/**
 * Returns user preferences.
 */
export function getUserPreferences(handle = 'atrv', db = getDb()) {
  const row = db.prepare('SELECT * FROM user_preferences WHERE handle = ?').get(handle);
  if (!row) {
    return {
      handle,
      hide_difficulty: false,
      contest_filter: 'ALL',
      min_diff: 1000,
      max_diff: 1500,
      muted: false
    };
  }
  return {
    handle: row.handle,
    hide_difficulty: Boolean(row.hide_difficulty),
    contest_filter: row.contest_filter,
    min_diff: row.min_diff,
    max_diff: row.max_diff,
    muted: Boolean(row.muted)
  };
}

/**
 * Updates user preferences.
 */
export function updateUserPreferences(handle = 'atrv', prefs = {}, db = getDb()) {
  const current = getUserPreferences(handle, db);
  const updated = { ...current, ...prefs };

  db.prepare(`
    INSERT OR REPLACE INTO user_preferences (
      handle, hide_difficulty, contest_filter, min_diff, max_diff, muted
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    handle,
    updated.hide_difficulty ? 1 : 0,
    updated.contest_filter,
    updated.min_diff,
    updated.max_diff,
    updated.muted ? 1 : 0
  );

  return updated;
}

/**
 * Returns all 25 tech tree nodes with current unlock and mastery statuses.
 */
export function getTechTree(db = getDb()) {
  const rows = db.prepare('SELECT * FROM tech_tree ORDER BY tier ASC, node_id ASC').all();
  return rows.map(r => ({
    node_id: r.node_id,
    title: r.title,
    tier: r.tier,
    category: r.category,
    prereqs: JSON.parse(r.prereqs_json || '[]'),
    unlock_threshold: r.unlock_threshold,
    solved_count: r.solved_count,
    status: r.is_mastered ? 'mastered' : (r.is_unlocked ? 'available' : 'locked'),
    is_unlocked: Boolean(r.is_unlocked),
    is_mastered: Boolean(r.is_mastered)
  }));
}

/**
 * Recomputes tech tree node solved counts and unlock statuses based on solved problems.
 */
export function recomputeTechTree(db = getDb()) {
  // 1. Calculate solved problems count per category
  const catRows = db.prepare(`
    SELECT category, COUNT(*) as count
    FROM problems
    WHERE is_solved = 1
    GROUP BY category
  `).all();

  const countByCat = {};
  for (const r of catRows) {
    countByCat[r.category] = r.count;
    const alias = CATEGORY_ALIASES[r.category];
    if (alias) countByCat[alias] = r.count;
  }

  // 2. Fetch all nodes
  const nodes = db.prepare('SELECT * FROM tech_tree').all();
  const nodeMap = new Map();
  for (const n of nodes) {
    const count = countByCat[n.category] || 0;
    n.solved_count = count;
    n.is_mastered = count >= 12 ? 1 : 0;
    nodeMap.set(n.node_id, n);
  }

  // 3. Determine unlock status:
  // Tier 1 is always unlocked.
  // Tier 2+ is unlocked if every parent in prereqs has solved_count >= parent.unlock_threshold
  for (const [nodeId, n] of nodeMap.entries()) {
    if (n.tier === 1) {
      n.is_unlocked = 1;
    } else {
      const prereqs = JSON.parse(n.prereqs_json || '[]');
      let allPassed = prereqs.length > 0;
      for (const parentId of prereqs) {
        const parent = nodeMap.get(parentId);
        if (!parent || parent.solved_count < n.unlock_threshold) {
          allPassed = false;
          break;
        }
      }
      n.is_unlocked = allPassed ? 1 : 0;
    }
  }

  // 4. Update tech tree table in DB
  const updateStmt = db.prepare(`
    UPDATE tech_tree
    SET solved_count = ?, is_unlocked = ?, is_mastered = ?
    WHERE node_id = ?
  `);

  db.exec('BEGIN TRANSACTION;');
  for (const n of nodeMap.values()) {
    updateStmt.run(n.solved_count, n.is_unlocked, n.is_mastered, n.node_id);
  }
  db.exec('COMMIT;');
}
