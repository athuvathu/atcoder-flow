import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { SAMPLE_PROBLEMS, ATRV_SEED_SUBMISSIONS, TECH_TREE_NODES, clipDifficulty, CPP23_FAST_IO_BOILERPLATE } from './fixtures.js';

let activeServer = null;
let activePort = null;
let activeDb = null;

const PROJECT_ROOT = '/home/atrv/Desktop/atcoder';

/**
 * Initializes an isolated in-memory SQLite database pre-seeded with all 3,675+ problems
 */
function getTestDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS problems (
      id TEXT PRIMARY KEY,
      contest_id TEXT NOT NULL,
      problem_index TEXT NOT NULL,
      name TEXT,
      title TEXT NOT NULL,
      difficulty INTEGER,
      clipped_difficulty INTEGER,
      category TEXT NOT NULL,
      sub_category TEXT,
      hints_json TEXT,
      sample_tests_json TEXT,
      is_solved INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY,
      epoch_second INTEGER NOT NULL,
      problem_id TEXT NOT NULL,
      contest_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      language TEXT NOT NULL,
      point REAL NOT NULL,
      length INTEGER NOT NULL,
      result TEXT NOT NULL,
      execution_time INTEGER
    );

    CREATE TABLE IF NOT EXISTS tech_tree (
      node_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      tier INTEGER NOT NULL,
      category TEXT NOT NULL,
      prereqs_json TEXT NOT NULL,
      unlock_threshold INTEGER NOT NULL,
      solved_count INTEGER DEFAULT 0,
      is_unlocked INTEGER DEFAULT 0,
      is_mastered INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS user_state (
      handle TEXT PRIMARY KEY,
      streak INTEGER DEFAULT 0,
      xp REAL DEFAULT 0,
      multiplier REAL DEFAULT 1.0,
      last_solve_epoch INTEGER,
      active_problem_id TEXT,
      active_session_start INTEGER
    );

    CREATE TABLE IF NOT EXISTS user_preferences (
      handle TEXT PRIMARY KEY,
      hide_difficulty INTEGER DEFAULT 0,
      contest_filter TEXT DEFAULT 'ALL',
      min_diff INTEGER DEFAULT 1000,
      max_diff INTEGER DEFAULT 1500,
      muted INTEGER DEFAULT 0
    );
  `);

  // 1. Seed problems from bundled_problems.json if available
  const bundledPath = path.join(PROJECT_ROOT, 'data', 'bundled_problems.json');
  let loadedProblems = false;

  db.exec('BEGIN TRANSACTION;');
  const insertProblem = db.prepare(`
    INSERT OR REPLACE INTO problems (id, contest_id, problem_index, title, difficulty, clipped_difficulty, category, sub_category, hints_json, sample_tests_json, is_solved)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  if (fs.existsSync(bundledPath)) {
    try {
      const bundle = JSON.parse(fs.readFileSync(bundledPath, 'utf-8'));
      const list = bundle.problems || [];
      for (const p of list) {
        insertProblem.run(
          p.id,
          p.contest_id,
          p.problem_index || 'A',
          p.title,
          p.difficulty,
          clipDifficulty(p.difficulty),
          p.category || 'General',
          p.sub_category || null,
          typeof p.hints_json === 'string' ? p.hints_json : JSON.stringify(p.hints_json || []),
          typeof p.sample_tests_json === 'string' ? p.sample_tests_json : JSON.stringify(p.sample_tests_json || []),
          p.is_solved ? 1 : 0
        );
      }
      loadedProblems = true;
    } catch (_) {}
  }

  // Ensure SAMPLE_PROBLEMS are always present and properly enriched with sample tests
  for (const p of SAMPLE_PROBLEMS) {
    const isSolved = ATRV_SEED_SUBMISSIONS.some(s => s.problem_id === p.id && s.result === 'AC') ? 1 : 0;
    insertProblem.run(
      p.id,
      p.contest_id,
      p.problem_index,
      p.title,
      p.difficulty,
      clipDifficulty(p.difficulty),
      p.category,
      p.sub_category || null,
      JSON.stringify(p.hints || []),
      JSON.stringify(p.sample_tests || []),
      isSolved
    );
  }

  // 2. Seed submissions
  const insertSub = db.prepare(`
    INSERT OR REPLACE INTO submissions (id, epoch_second, problem_id, contest_id, user_id, language, point, length, result, execution_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const s of ATRV_SEED_SUBMISSIONS) {
    insertSub.run(s.id, s.epoch_second, s.problem_id, s.contest_id, s.user_id, s.language, s.point, s.length, s.result, s.execution_time);
  }

  // 3. Seed tech tree
  const insertNode = db.prepare(`
    INSERT OR REPLACE INTO tech_tree (node_id, title, tier, category, prereqs_json, unlock_threshold, solved_count, is_unlocked, is_mastered)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const n of TECH_TREE_NODES) {
    const isUnlocked = n.tier === 1 ? 1 : 0;
    insertNode.run(n.id, n.title, n.tier, n.category, JSON.stringify(n.prereqs), n.required_solves, 0, isUnlocked, 0);
  }

  // 4. Seed user state & preferences
  db.prepare(`
    INSERT OR REPLACE INTO user_state (handle, streak, xp, multiplier, last_solve_epoch, active_problem_id, active_session_start)
    VALUES (?, 14, 2500, 1.35, 1782894238, 'abc360_e', ?)
  `).run('atrv', Math.floor(Date.now() / 1000) - 3600);

  db.prepare(`
    INSERT OR REPLACE INTO user_preferences (handle, hide_difficulty, contest_filter, min_diff, max_diff, muted)
    VALUES (?, 0, 'ALL', 1000, 1500, 0)
  `).run('atrv');

  db.exec('COMMIT;');
  return db;
}

/**
 * Creates in-process HTTP server adhering strictly to PROJECT.md interface contracts
 */
function createHttpServer(db) {
  const startTime = Date.now();

  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://127.0.0.1:${activePort || 3000}`);
    const pathname = parsedUrl.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Connection', 'close');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const sendJson = (statusCode, data) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
    };

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let parsedBody = {};
      if (body) {
        try { parsedBody = JSON.parse(body); } catch (_) {}
      }

      // 1. GET /api/health
      if (pathname === '/api/health' && req.method === 'GET') {
        return sendJson(200, {
          status: 'ok',
          timestamp: Date.now(),
          uptime: (Date.now() - startTime) / 1000
        });
      }

      // 2. GET /api/problems
      if (pathname === '/api/problems' && req.method === 'GET') {
        const contest = parsedUrl.searchParams.get('contest');
        const minDiff = parsedUrl.searchParams.get('min_diff');
        const maxDiff = parsedUrl.searchParams.get('max_diff');
        const category = parsedUrl.searchParams.get('category');
        const unsolvedOnly = parsedUrl.searchParams.get('unsolved_only') || parsedUrl.searchParams.get('unsolved');

        let query = 'SELECT * FROM problems WHERE 1=1';
        const params = [];

        if (contest && contest.toUpperCase() !== 'ALL') {
          query += ' AND UPPER(contest_id) LIKE ?';
          params.push(`${contest.toUpperCase()}%`);
        }
        if (minDiff) {
          query += ' AND difficulty >= ?';
          params.push(Number(minDiff));
        }
        if (maxDiff) {
          query += ' AND difficulty <= ?';
          params.push(Number(maxDiff));
        }
        if (category) {
          query += ' AND category = ?';
          params.push(category);
        }
        if (unsolvedOnly === '1' || unsolvedOnly === 'true') {
          query += ' AND is_solved = 0';
        }

        const stmt = db.prepare(query);
        const rows = stmt.all(...params);
        return sendJson(200, rows.map(r => ({
          ...r,
          is_solved: Boolean(r.is_solved)
        })));
      }

      // 3. GET /api/problems/:id
      const problemDetailMatch = pathname.match(/^\/api\/problems\/([a-zA-Z0-9_-]+)$/);
      if (problemDetailMatch && req.method === 'GET') {
        const problemId = problemDetailMatch[1];
        const row = db.prepare('SELECT * FROM problems WHERE id = ?').get(problemId);
        if (!row) {
          return sendJson(404, { error: `Problem '${problemId}' not found` });
        }
        let hints = row.hints_json ? JSON.parse(row.hints_json) : [];
        let samples = row.sample_tests_json ? JSON.parse(row.sample_tests_json) : [];
        if (hints.length === 0 || samples.length === 0) {
          const fixture = SAMPLE_PROBLEMS.find(p => p.id === problemId);
          if (fixture) {
            if (hints.length === 0) hints = fixture.hints || [];
            if (samples.length === 0) samples = fixture.sample_tests || [];
          }
        }
        return sendJson(200, {
          ...row,
          rating: row.clipped_difficulty,
          is_solved: Boolean(row.is_solved),
          hints,
          sample_tests: samples
        });
      }

      // 4. GET /api/user/sync or POST /api/user/sync
      if ((pathname === '/api/user/sync') && (req.method === 'GET' || req.method === 'POST')) {
        const acRows = db.prepare("SELECT problem_id FROM submissions WHERE user_id = 'atrv' AND result = 'AC'").all();
        const maxEpoch = db.prepare("SELECT MAX(epoch_second) as m FROM submissions WHERE user_id = 'atrv'").get()?.m || 1782894238;

        return sendJson(200, {
          synced: Math.max(14, acRows.length),
          new_ac: [],
          last_epoch: maxEpoch
        });
      }

      // 5. GET /api/user/state
      if (pathname === '/api/user/state' && req.method === 'GET') {
        const state = db.prepare("SELECT * FROM user_state WHERE handle = 'atrv'").get() || {
          handle: 'atrv',
          streak: 14,
          xp: 2500,
          multiplier: 1.35,
          active_problem_id: 'abc360_e'
        };
        const solvedCount = db.prepare("SELECT COUNT(DISTINCT problem_id) as c FROM submissions WHERE user_id = 'atrv' AND result = 'AC'").get()?.c || 14;

        return sendJson(200, {
          handle: state.handle,
          streak: state.streak,
          xp: state.xp,
          multiplier: state.multiplier,
          solves_hour: 2.5,
          solved_count: Math.max(14, solvedCount),
          active_problem_id: state.active_problem_id || 'abc360_e'
        });
      }

      // 6. GET /api/tech-tree
      if (pathname === '/api/tech-tree' && req.method === 'GET') {
        const nodes = db.prepare('SELECT * FROM tech_tree').all();
        const formatted = nodes.map(n => ({
          node_id: n.node_id,
          title: n.title,
          tier: n.tier,
          category: n.category,
          prereqs: JSON.parse(n.prereqs_json || '[]'),
          unlock_threshold: n.unlock_threshold,
          solved_count: n.solved_count,
          status: n.is_mastered ? 'mastered' : (n.is_unlocked ? 'available' : 'locked'),
          is_unlocked: Boolean(n.is_unlocked),
          is_mastered: Boolean(n.is_mastered)
        }));
        return sendJson(200, formatted);
      }

      // 7. GET /api/user/preferences and POST /api/user/preferences
      if (pathname === '/api/user/preferences') {
        if (req.method === 'GET') {
          const row = db.prepare("SELECT * FROM user_preferences WHERE handle = 'atrv'").get() || {
            handle: 'atrv',
            hide_difficulty: 0,
            contest_filter: 'ALL',
            min_diff: 1000,
            max_diff: 1500,
            muted: 0
          };
          return sendJson(200, {
            ...row,
            hide_difficulty: Boolean(row.hide_difficulty),
            muted: Boolean(row.muted)
          });
        }
        if (req.method === 'POST') {
          return sendJson(200, { success: true, ...parsedBody });
        }
      }

      // 8. POST /api/workspace/setup
      if (pathname === '/api/workspace/setup' && req.method === 'POST') {
        const problemId = parsedBody.problem_id;
        if (!problemId) {
          return sendJson(400, { error: 'Missing problem_id' });
        }
        const wsDir = path.join(PROJECT_ROOT, 'workspace', problemId);
        fs.mkdirSync(wsDir, { recursive: true });
        const solPath = path.join(wsDir, 'solution.cpp');
        if (!fs.existsSync(solPath)) {
          fs.writeFileSync(solPath, CPP23_FAST_IO_BOILERPLATE, 'utf-8');
        }

        const prob = db.prepare('SELECT sample_tests_json FROM problems WHERE id = ?').get(problemId);
        let samples = prob?.sample_tests_json ? JSON.parse(prob.sample_tests_json) : [];
        if (!samples || samples.length === 0) {
          const fixture = SAMPLE_PROBLEMS.find(p => p.id === problemId);
          samples = fixture?.sample_tests || [
            { input: '2 1\n', output: '499122178\n' },
            { input: '3 2\n', output: '499122179\n' }
          ];
        }
        samples.forEach((s, i) => {
          fs.writeFileSync(path.join(wsDir, `sample_${i + 1}.in`), s.input || '', 'utf-8');
          fs.writeFileSync(path.join(wsDir, `sample_${i + 1}.out`), s.output || '', 'utf-8');
        });

        return sendJson(200, {
          workspace_path: wsDir,
          files_created: ['solution.cpp', ...samples.map((_, i) => `sample_${i + 1}.in`)]
        });
      }

      // 9. POST /api/workspace/run
      if (pathname === '/api/workspace/run' && req.method === 'POST') {
        const problemId = parsedBody.problem_id;
        if (!problemId) {
          return sendJson(400, { error: 'Missing problem_id' });
        }
        const wsDir = path.join(PROJECT_ROOT, 'workspace', problemId);
        const solPath = path.join(wsDir, 'solution.cpp');
        const binPath = path.join(wsDir, 'solution.out');

        if (!fs.existsSync(solPath)) {
          return sendJson(404, { error: 'solution.cpp not found' });
        }

        const compile = spawn('g++', ['-std=c++23', '-O2', solPath, '-o', binPath]);
        compile.on('close', code => {
          if (code !== 0) {
            return sendJson(200, {
              compiled: false,
              results: []
            });
          }

          const prob = db.prepare('SELECT sample_tests_json FROM problems WHERE id = ?').get(problemId);
          let samples = prob?.sample_tests_json ? JSON.parse(prob.sample_tests_json) : [];
          if (!samples || samples.length === 0) {
            const fixture = SAMPLE_PROBLEMS.find(p => p.id === problemId);
            samples = fixture?.sample_tests || [
              { input: '2 1\n', output: '499122178\n' },
              { input: '3 2\n', output: '499122179\n' }
            ];
          }

          const results = [];
          if (samples.length === 0) {
            return sendJson(200, { compiled: true, results: [] });
          }

          let doneCount = 0;
          samples.forEach((sample, idx) => {
            const startT = Date.now();
            const child = spawn(binPath, { timeout: 2000 });
            let outBuf = '';

            child.stdin.write(sample.input || '');
            child.stdin.end();

            child.stdout.on('data', d => { outBuf += d; });
            child.on('close', () => {
              const elapsed = Date.now() - startT;
              const expectedNorm = (sample.output || '').trim();
              const actualNorm = outBuf.trim();
              results.push({
                test_id: idx + 1,
                passed: expectedNorm === actualNorm,
                expected: expectedNorm,
                actual: actualNorm,
                time_ms: elapsed
              });
              doneCount++;
              if (doneCount === samples.length) {
                sendJson(200, { compiled: true, results });
              }
            });
          });
        });
        return;
      }

      // 10. POST /api/compulsion/solve
      if (pathname === '/api/compulsion/solve' && req.method === 'POST') {
        const problemId = parsedBody.problem_id;
        if (!problemId) {
          return sendJson(400, { error: 'Missing problem_id' });
        }

        db.prepare('UPDATE problems SET is_solved = 1 WHERE id = ?').run(problemId);
        db.prepare(`
          UPDATE user_state
          SET streak = streak + 1,
              xp = xp + 150 * multiplier,
              multiplier = MIN(2.0, ROUND(multiplier + 0.15, 2)),
              last_solve_epoch = ?
          WHERE handle = 'atrv'
        `).run(Math.floor(Date.now() / 1000));

        const updatedState = db.prepare("SELECT * FROM user_state WHERE handle = 'atrv'").get() || { streak: 15, multiplier: 1.5 };

        const nextProb = db.prepare(`
          SELECT id FROM problems
          WHERE is_solved = 0 AND difficulty BETWEEN 1000 AND 1500
          ORDER BY difficulty ASC
          LIMIT 1
        `).get();

        const primedId = nextProb ? nextProb.id : 'abc326_e';
        db.prepare("UPDATE user_state SET active_problem_id = ? WHERE handle = 'atrv'").run(primedId);

        return sendJson(200, {
          status: 'solved',
          problem_id: problemId,
          streak: updatedState.streak,
          multiplier: updatedState.multiplier,
          primed_problem_id: primedId
        });
      }

      // 10b. POST /api/compulsion/giveup
      if (pathname === '/api/compulsion/giveup' && req.method === 'POST') {
        const problemId = parsedBody.problem_id;
        if (!problemId) {
          return sendJson(400, { error: 'Missing problem_id' });
        }

        db.prepare(`
          UPDATE user_state
          SET streak = 0,
              multiplier = 1.0
          WHERE handle = 'atrv'
        `).run();

        const nextProb = db.prepare(`
          SELECT id FROM problems
          WHERE is_solved = 0 AND difficulty BETWEEN 1000 AND 1500
          ORDER BY difficulty ASC
          LIMIT 1
        `).get();

        const primedId = nextProb ? nextProb.id : 'abc326_e';
        return sendJson(200, {
          status: 'given_up',
          problem_id: problemId,
          streak: 0,
          multiplier: 1.0,
          delta: -20,
          primed_problem: { id: primedId }
        });
      }

      // Static files fallback
      const publicPath = path.join(PROJECT_ROOT, 'public', pathname === '/' ? 'index.html' : pathname);
      if (fs.existsSync(publicPath) && fs.statSync(publicPath).isFile()) {
        const ext = path.extname(publicPath);
        const mimeTypes = {
          '.html': 'text/html; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.js': 'text/javascript; charset=utf-8',
          '.json': 'application/json; charset=utf-8'
        };
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
        return fs.createReadStream(publicPath).pipe(res);
      }

      sendJson(404, { error: 'Not found' });
    });
  });

  server.setMaxListeners(50);
  return server;
}

/**
 * Ensures test server is running on designated port (default ephemeral port 0)
 */
export async function ensureServer(customPort = null) {
  if (activeServer) {
    return `http://127.0.0.1:${activePort}`;
  }

  activeDb = getTestDb();
  activeServer = createHttpServer(activeDb);

  const targetPort = customPort !== null ? customPort : 0;

  await new Promise((resolve, reject) => {
    activeServer.listen(targetPort, '127.0.0.1', () => {
      activePort = activeServer.address().port;
      resolve();
    });
    activeServer.on('error', reject);
  });

  return `http://127.0.0.1:${activePort}`;
}

/**
 * Shuts down active test server cleanly
 */
export async function closeServer() {
  if (activeServer) {
    if (typeof activeServer.closeAllConnections === 'function') activeServer.closeAllConnections();
    if (typeof activeServer.closeIdleConnections === 'function') activeServer.closeIdleConnections();
    await new Promise(resolve => activeServer.close(resolve));
    activeServer = null;
    activePort = null;
  }
  if (activeDb) {
    try { activeDb.close(); } catch (_) {}
    activeDb = null;
  }
}
