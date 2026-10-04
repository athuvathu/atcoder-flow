// Request routing and request handlers for AtCoder Flow Practice Platform
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getDb,
  getProblems,
  getProblemById,
  getUserState,
  updateUserState,
  getUserPreferences,
  updateUserPreferences,
  getTechTree,
  calculateUserBaselineRating,
  calculateParTime,
  getNextRecommendedProblem,
  recordSolve,
  recordSkip,
  saveProblemScrapedDetails
} from './db.js';
import { syncUserSubmissions, checkProblemSubmission } from './sync.js';
import { scrapeProblemDetails } from './scraper.js';
import { pushToLocalCPH } from './cph.js';
import { atcoderToCodeforces } from '../public/rating.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');

const serverStartTime = Date.now();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

/**
 * Sends a JSON response with CORS headers.
 */
export function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

/**
 * Parses JSON request body.
 */
export function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Request entity too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Serves static files from /public/ directory.
 */
export function serveStaticFile(req, res, pathname) {
  let targetPath = pathname === '/' ? '/index.html' : pathname;
  const safePath = path.normalize(targetPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendJson(res, 403, { error: 'Forbidden' });
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      return sendJson(res, 404, { error: 'File not found' });
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache'
    });

    if (req.method === 'HEAD') {
      return res.end();
    }

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

/**
 * Main request router.
 */
export async function handleRequest(req, res) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    });
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method;

  try {
    // 1. GET /api/health
    if (method === 'GET' && pathname === '/api/health') {
      const uptimeSeconds = (Date.now() - serverStartTime) / 1000;
      return sendJson(res, 200, {
        status: 'ok',
        timestamp: Date.now(),
        uptime: uptimeSeconds
      });
    }

    // 2. GET /api/problems
    if (method === 'GET' && pathname === '/api/problems') {
      const filters = {
        contest: url.searchParams.get('contest'),
        min_diff: url.searchParams.get('min_diff'),
        max_diff: url.searchParams.get('max_diff'),
        category: url.searchParams.get('category'),
        unsolved: url.searchParams.get('unsolved') || url.searchParams.get('unsolved_only')
      };
      const problems = getProblems(filters);
      return sendJson(res, 200, problems);
    }

    // 3. GET /api/flow/next (Adaptive next problem in flow channel)
    if (method === 'GET' && pathname === '/api/flow/next') {
      const handle = url.searchParams.get('handle') || url.searchParams.get('user') || 'atrv';
      const mode = url.searchParams.get('mode') || 'flow';
      const category = url.searchParams.get('category') || null;
      const problem = getNextRecommendedProblem(handle, mode, category);
      if (!problem) {
        return sendJson(res, 404, { error: 'No unsolved problems found in active range' });
      }
      return sendJson(res, 200, problem);
    }

    // 4a. GET /api/problems/:id/statement (Real AtCoder problem statement & sample tests)
    const statementMatch = pathname.match(/^\/api\/problems\/([a-zA-Z0-9_-]+)\/statement$/);
    if (method === 'GET' && statementMatch) {
      const problemId = statementMatch[1];
      const problem = getProblemById(problemId);
      if (!problem) {
        return sendJson(res, 404, { error: `Problem '${problemId}' not found` });
      }

      // If cached in DB, return immediately
      if (problem.statement_html && problem.sample_tests && problem.sample_tests.length > 0) {
        return sendJson(res, 200, {
          problem_id: problem.id,
          time_limit_ms: problem.time_limit_ms || 2000,
          memory_limit_mb: problem.memory_limit_mb || 1024,
          statement_html: problem.statement_html,
          samples: problem.sample_tests
        });
      }

      // Otherwise scrape live from AtCoder and cache to SQLite
      try {
        const scraped = await scrapeProblemDetails(problem.contest_id, problem.id);
        saveProblemScrapedDetails(problem.id, scraped);
        return sendJson(res, 200, {
          problem_id: problem.id,
          time_limit_ms: scraped.time_limit_ms,
          memory_limit_mb: scraped.memory_limit_mb,
          statement_html: scraped.statement_html,
          samples: scraped.samples
        });
      } catch (err) {
        console.warn(`[scraper] Warning: Failed to scrape statement for ${problem.id}:`, err.message);
        return sendJson(res, 502, {
          error: `Could not fetch statement from AtCoder: ${err.message}`,
          problem_id: problem.id,
          url: problem.url
        });
      }
    }

    // 4b. POST /api/cph/push (Direct push to local Competitive Companion / CPH listener)
    if (method === 'POST' && pathname === '/api/cph/push') {
      const body = await parseJsonBody(req).catch(() => ({}));
      const problemId = body.problem_id;
      if (!problemId) {
        return sendJson(res, 400, { error: 'Missing problem_id' });
      }

      let problem = getProblemById(problemId);
      if (!problem) {
        return sendJson(res, 404, { error: `Problem '${problemId}' not found` });
      }

      let samples = problem.sample_tests || [];
      if (!samples || samples.length === 0) {
        try {
          const scraped = await scrapeProblemDetails(problem.contest_id, problem.id);
          saveProblemScrapedDetails(problem.id, scraped);
          samples = scraped.samples;
          problem.time_limit_ms = scraped.time_limit_ms;
          problem.memory_limit_mb = scraped.memory_limit_mb;
        } catch (err) {
          console.warn(`[cph] Warning: could not scrape real samples before CPH push:`, err.message);
        }
      }

      const cphResult = await pushToLocalCPH(problem, samples);
      return sendJson(res, cphResult.delivered ? 200 : 503, cphResult);
    }

    // 4c. GET /api/problems/:id
    const problemIdMatch = pathname.match(/^\/api\/problems\/([a-zA-Z0-9_-]+)$/);
    if (method === 'GET' && problemIdMatch) {
      const problemId = problemIdMatch[1];
      const problem = getProblemById(problemId);
      if (!problem) {
        return sendJson(res, 404, { error: `Problem '${problemId}' not found` });
      }
      return sendJson(res, 200, problem);
    }

    // 5. POST /api/compulsion/solve (Instant AC check & optimistic fallback)
    if (method === 'POST' && pathname === '/api/compulsion/solve') {
      const body = await parseJsonBody(req).catch(() => ({}));
      const problemId = body.problem_id;
      const handle = body.handle || 'atrv';
      const elapsedSeconds = parseInt(body.elapsed_seconds, 10) || 0;
      const optimistic = Boolean(body.optimistic || body.manual);

      if (!problemId) {
        return sendJson(res, 400, { error: 'Missing problem_id' });
      }

      const problem = getProblemById(problemId);
      if (!problem) {
        return sendJson(res, 404, { error: `Problem '${problemId}' not found` });
      }

      if (problem.is_solved) {
        return sendJson(res, 409, {
          error: `Problem '${problemId}' is already marked as solved`,
          already_solved: true
        });
      }

      // Check Kenkoooo or allow optimistic attestation
      if (!optimistic) {
        const checkResult = await checkProblemSubmission(handle, problemId);
        if (!checkResult.verified) {
          return sendJson(res, 200, {
            verified: false,
            lag_possible: true,
            message: 'No verified AC on Kenkoooo yet (API delay). You can wait or press [Enter] to Attest AC now.'
          });
        }
      }

      // Record solve & compute Par metrics
      const solveResult = recordSolve(handle, problemId, elapsedSeconds, optimistic);
      const parSeconds = solveResult.par_seconds;
      const beatPar = elapsedSeconds <= parSeconds;
      const parDiff = parSeconds - elapsedSeconds;

      // Solve performance score based on speed vs Par (honest, deflated)
      const baseDiff = problem.clipped_difficulty || 1200;
      const isCritical = elapsedSeconds > 0 && elapsedSeconds <= parSeconds * 0.5;
      const isClutch = !isCritical && elapsedSeconds >= parSeconds * 0.85 && elapsedSeconds <= parSeconds;

      let speedBonus = 0;
      if (elapsedSeconds <= parSeconds) {
        speedBonus = Math.round(((parSeconds - elapsedSeconds) / parSeconds) * 75);
      } else {
        speedBonus = Math.max(-120, Math.round(((parSeconds - elapsedSeconds) / parSeconds) * 80));
      }

      let speedSurgeBonus = 0;
      if (isCritical) {
        speedSurgeBonus = Math.min(25, Math.floor(((parSeconds * 0.5 - elapsedSeconds) / (parSeconds * 0.5)) * 25));
      }

      const solvePerformance = Math.max(400, Math.round(baseDiff + speedBonus + speedSurgeBonus));

      const cfPerf = atcoderToCodeforces(solvePerformance);
      const cfTr = atcoderToCodeforces(solveResult.training_rating);

      return sendJson(res, 200, {
        status: 'solved',
        verified: true,
        problem_id: problemId,
        solve_performance: solvePerformance,
        cf_solve_performance: cfPerf.cfRating,
        cf_title: cfPerf.title,
        training_rating: solveResult.training_rating,
        cf_training_rating: cfTr.cfRating,
        rating_delta: solveResult.rating_delta,
        par_seconds: parSeconds,
        elapsed_seconds: elapsedSeconds,
        beat_par: beatPar,
        par_diff_seconds: parDiff,
        is_critical: isCritical,
        is_clutch: isClutch,
        speed_surge_bonus: speedSurgeBonus,
        streak: solveResult.streak,
        multiplier: solveResult.multiplier,
        xp_gained: solveResult.xp_gained,
        is_optimistic: solveResult.is_optimistic,
        primed_problem: solveResult.primed_problem
      });
    }

    // 6. POST /api/compulsion/skip
    if (method === 'POST' && pathname === '/api/compulsion/skip') {
      const body = await parseJsonBody(req).catch(() => ({}));
      const problemId = body.problem_id;
      const handle = body.handle || 'atrv';
      const reason = body.reason || 'neutral'; // 'too_hard' | 'too_easy' | 'neutral'

      if (!problemId) {
        return sendJson(res, 400, { error: 'Missing problem_id' });
      }

      const skipResult = recordSkip(handle, problemId, reason);
      return sendJson(res, 200, skipResult);
    }

    // 7. POST /api/session/state (Persists stopwatch and pause state)
    if (method === 'POST' && pathname === '/api/session/state') {
      const body = await parseJsonBody(req).catch(() => ({}));
      const handle = body.handle || 'atrv';
      const updates = {};
      if (body.active_problem_id !== undefined) updates.active_problem_id = body.active_problem_id;
      if (body.session_paused !== undefined) updates.session_paused = body.session_paused ? 1 : 0;
      if (body.session_elapsed_seconds !== undefined) updates.session_elapsed_seconds = parseInt(body.session_elapsed_seconds, 10);
      if (body.session_solves !== undefined) updates.session_solves = parseInt(body.session_solves, 10);

      const state = updateUserState(handle, updates);
      return sendJson(res, 200, state);
    }

    // 8. GET /api/user/sync or POST /api/user/sync
    if ((method === 'GET' || method === 'POST') && pathname === '/api/user/sync') {
      let handle = url.searchParams.get('user') || url.searchParams.get('handle') || 'atrv';
      if (method === 'POST') {
        const body = await parseJsonBody(req).catch(() => ({}));
        if (body.user) handle = body.user;
        if (body.handle) handle = body.handle;
      }
      const syncResult = await syncUserSubmissions(handle);
      return sendJson(res, 200, {
        synced: syncResult.synced,
        count: syncResult.count,
        new_ac: syncResult.new_ac,
        last_epoch: syncResult.last_epoch,
        fallback_cache: syncResult.fallback_cache,
        error: syncResult.error
      });
    }

    // 9. GET /api/user/state or GET /api/user/stats
    if (method === 'GET' && (pathname === '/api/user/state' || pathname === '/api/user/stats')) {
      const handle = url.searchParams.get('handle') || url.searchParams.get('user') || 'atrv';
      const state = getUserState(handle);
      return sendJson(res, 200, state);
    }

    // 10. GET /api/tech-tree
    if (method === 'GET' && pathname === '/api/tech-tree') {
      const nodes = getTechTree();
      return sendJson(res, 200, nodes);
    }

    // 11. GET /api/user/preferences and POST /api/user/preferences
    if (pathname === '/api/user/preferences') {
      const handle = url.searchParams.get('handle') || url.searchParams.get('user') || 'atrv';
      if (method === 'GET') {
        const prefs = getUserPreferences(handle);
        return sendJson(res, 200, prefs);
      }
      if (method === 'POST') {
        const body = await parseJsonBody(req);
        const updated = updateUserPreferences(handle, body);
        return sendJson(res, 200, updated);
      }
    }

    // 12. POST /api/user/handle (Switch active handle and retrieve state)
    if (method === 'POST' && pathname === '/api/user/handle') {
      const body = await parseJsonBody(req).catch(() => ({}));
      const newHandle = (body.handle || '').trim();
      if (!newHandle) {
        return sendJson(res, 400, { error: 'Handle cannot be empty' });
      }
      const state = getUserState(newHandle);
      return sendJson(res, 200, state);
    }

    // 12. Static file serving fallback
    if (method === 'GET' || method === 'HEAD') {
      return serveStaticFile(req, res, pathname);
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error(`[router] Unhandled error handling ${method} ${pathname}:`, err);
    return sendJson(res, 500, { error: 'Internal server error', details: err.message });
  }
}
