// Client-Side In-Memory Data Store & Game Engine for AtCoder Flow
// 100% Static & Surge-Compatible — No Node.js backend required!

import { atcoderToCodeforces } from './rating.js';

class FlowStoreClass {
  constructor() {
    this.problems = [];
    this.problemMap = new Map();
    this.techTreeNodes = [];
    this.solvedSet = new Set();
    this.isLoaded = false;
    this.loadPromise = null;

    // Default User State
    this.userState = {
      handle: 'atrv',
      streak: 0,
      xp: 0,
      multiplier: 1,
      training_rating: 1200,
      session_paused: 0,
      session_elapsed_seconds: 0,
      session_solves: 0,
      solves_hour: 0,
      solved_count: 0,
      last_solve_epoch: 0,
      solved_ids: [],
      preferences: { muted: false, mode: 'flow' }
    };
  }

  /**
   * Initializes store, loading problems.json and tech_tree.json, and hydrating localStorage.
   */
  async init() {
    if (this.isLoaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      this.hydrateFromLocalStorage();

      try {
        const [probRes, treeRes] = await Promise.all([
          fetch('/data/problems.json'),
          fetch('/data/tech_tree.json')
        ]);

        if (probRes.ok) {
          this.problems = await probRes.json();
          this.problemMap.clear();
          for (const p of this.problems) {
            this.problemMap.set(p.id, p);
          }
        }

        if (treeRes.ok) {
          this.techTreeNodes = await treeRes.json();
        }
      } catch (err) {
        console.warn('[FlowStore] Failed to load data JSON:', err);
      }

      this.isLoaded = true;
    })();

    return this.loadPromise;
  }

  hydrateFromLocalStorage() {
    try {
      const saved = localStorage.getItem('atcoder_flow_user_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.userState = { ...this.userState, ...parsed };
      }
    } catch (_) {}

    this.solvedSet = new Set(this.userState.solved_ids || []);
    this.userState.solved_count = this.solvedSet.size;
  }

  saveToLocalStorage() {
    try {
      this.userState.solved_ids = Array.from(this.solvedSet);
      this.userState.solved_count = this.solvedSet.size;
      localStorage.setItem('atcoder_flow_user_state', JSON.stringify(this.userState));
    } catch (_) {}
  }

  getUserState() {
    return { ...this.userState, solved_count: this.solvedSet.size };
  }

  setHandle(newHandle) {
    if (!newHandle || !newHandle.trim()) return;
    this.userState.handle = newHandle.trim();
    this.saveToLocalStorage();
    return this.getUserState();
  }

  saveUserPreferences(prefs) {
    this.userState.preferences = { ...this.userState.preferences, ...prefs };
    this.saveToLocalStorage();
  }

  getUserPreferences() {
    return this.userState.preferences || {};
  }

  isSolved(problemId) {
    return this.solvedSet.has(problemId);
  }

  getProblems(filters = {}) {
    let result = this.problems.map(p => ({
      ...p,
      is_solved: this.isSolved(p.id)
    }));

    if (filters.category) {
      const cat = filters.category.toLowerCase();
      result = result.filter(p => (p.category || '').toLowerCase() === cat);
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(p =>
        (p.id || '').toLowerCase().includes(q) ||
        (p.title || '').toLowerCase().includes(q) ||
        (p.name || '').toLowerCase().includes(q) ||
        (p.contest_id || '').toLowerCase().includes(q)
      );
    }

    if (filters.unsolved) {
      result = result.filter(p => !p.is_solved);
    }

    if (filters.minDiff !== undefined) {
      result = result.filter(p => (p.clipped_difficulty || 0) >= filters.minDiff);
    }

    if (filters.maxDiff !== undefined) {
      result = result.filter(p => (p.clipped_difficulty || 0) <= filters.maxDiff);
    }

    return result;
  }

  getProblem(problemId) {
    const prob = this.problemMap.get(problemId);
    if (!prob) return null;
    return { ...prob, is_solved: this.isSolved(prob.id) };
  }

  getTechTree() {
    const solvedCounts = {};
    for (const id of this.solvedSet) {
      const p = this.problemMap.get(id);
      if (p && p.category) {
        solvedCounts[p.category] = (solvedCounts[p.category] || 0) + 1;
      }
    }

    return this.techTreeNodes.map(node => {
      const solved = solvedCounts[node.category] || 0;
      const total = node.total_problems || 50;
      return {
        ...node,
        solved_count: solved,
        is_unlocked: true,
        mastery_percent: Math.min(100, Math.round((solved / Math.max(1, total)) * 100))
      };
    });
  }

  /**
   * Only-Bangers Golden Era Problem Selection Engine (ABC 150+, ARC 100+, DP).
   */
  getNextFlowProblem(mode = 'flow') {
    const tr = this.userState.training_rating || 1200;

    let minDiff, maxDiff;
    switch (mode) {
      case 'warmup':
        minDiff = tr - 250;
        maxDiff = tr - 50;
        break;
      case 'speed':
        minDiff = tr - 200;
        maxDiff = tr - 50;
        break;
      case 'reach':
        minDiff = tr + 100;
        maxDiff = tr + 250;
        break;
      case 'boss':
        minDiff = tr + 120;
        maxDiff = tr + 350;
        break;
      case 'flow':
      default:
        minDiff = tr - 50;
        maxDiff = tr + 120;
        break;
    }

    // Filter to Golden Era candidates
    const candidates = this.problems.filter(p => {
      if (this.isSolved(p.id)) return false;

      const diff = p.clipped_difficulty || 1200;
      if (diff < minDiff || diff > maxDiff) return false;

      const contest = (p.contest_id || '').toLowerCase();
      if (contest === 'dp') return true;

      if (contest.startsWith('abc')) {
        const num = parseInt(contest.slice(3), 10);
        return !isNaN(num) && num >= 150;
      }

      if (contest.startsWith('arc')) {
        const num = parseInt(contest.slice(3), 10);
        return !isNaN(num) && num >= 100;
      }

      return false;
    });

    if (candidates.length === 0) {
      // Fallback: relax boundaries slightly if pool depleted
      const fallback = this.problems.filter(p => !this.isSolved(p.id));
      if (fallback.length === 0) return this.problems[0];
      return fallback[Math.floor(Math.random() * Math.min(10, fallback.length))];
    }

    // Kotler 4% challenge sweet-spot proximity sorting
    const targetDiff = tr + (mode === 'flow' ? Math.round(tr * 0.04) : (minDiff + maxDiff) / 2);
    candidates.sort((a, b) => {
      const distA = Math.abs((a.clipped_difficulty || 1200) - targetDiff);
      const distB = Math.abs((b.clipped_difficulty || 1200) - targetDiff);
      return distA - distB;
    });

    // Random choice among top 5 nearest candidates for variety
    const poolSize = Math.min(5, candidates.length);
    const chosen = candidates[Math.floor(Math.random() * poolSize)];
    return { ...chosen, is_solved: false };
  }

  /**
   * Records AC solve, computes Par pacing bonuses and Speed Surge dynamics.
   * Calibrated with honest, deflated CP performance and Elo-principled rating delta.
   */
  recordSolve(problemId, elapsedSeconds, isAttested = true) {
    const problem = this.getProblem(problemId) || { id: problemId, clipped_difficulty: 1200 };
    const baseDiff = problem.clipped_difficulty || 1200;

    const parSeconds = Math.min(2100, Math.max(480, Math.round(600 + (baseDiff - 1000) * 1.5)));

    // Pacing vs Par: measured speed adjustment anchored to difficulty
    let speedBonus = 0;
    if (elapsedSeconds <= parSeconds) {
      // Ahead of par: up to +75 pts for solving significantly faster than par
      speedBonus = Math.round(((parSeconds - elapsedSeconds) / parSeconds) * 75);
    } else {
      // Slower than par: realistic pacing penalty up to -120 pts
      speedBonus = Math.max(-120, Math.round(((parSeconds - elapsedSeconds) / parSeconds) * 80));
    }

    const isCritical = elapsedSeconds <= 0.5 * parSeconds;
    // Speed Surge bonus for blistering execution: max +25 pts
    const speedSurgeBonus = isCritical
      ? Math.min(25, Math.floor(((0.5 * parSeconds - elapsedSeconds) / (0.5 * parSeconds)) * 25))
      : 0;

    const isClutch = !isCritical && (elapsedSeconds >= 0.85 * parSeconds && elapsedSeconds <= parSeconds);

    // Honest solve performance anchored to problem difficulty
    const solvePerformance = Math.max(400, Math.round(baseDiff + speedBonus + speedSurgeBonus));
    const cfPerf = atcoderToCodeforces(solvePerformance);

    // Elo-principled Training Rating progression
    const currentTr = this.userState.training_rating || 1200;
    const expectedScore = 1 / (1 + Math.pow(10, (currentTr - baseDiff) / 400));
    const baseDelta = Math.max(1, Math.round(16 * (1 - expectedScore)));

    let speedDeltaBonus = 0;
    if (isCritical) {
      speedDeltaBonus = 4;
    } else if (elapsedSeconds <= parSeconds) {
      speedDeltaBonus = 1;
    } else if (elapsedSeconds > 1.5 * parSeconds) {
      speedDeltaBonus = -3;
    } else {
      speedDeltaBonus = -1;
    }

    const ratingDelta = Math.max(1, Math.min(22, baseDelta + speedDeltaBonus));

    // Update state
    this.userState.training_rating = Math.round(this.userState.training_rating + ratingDelta);
    this.userState.streak = (this.userState.streak || 0) + 1;
    this.userState.multiplier = Math.min(4, 1 + Math.floor(this.userState.streak / 5) * 0.25);
    const xpGained = Math.round((baseDiff / 10) * this.userState.multiplier);
    this.userState.xp = (this.userState.xp || 0) + xpGained;
    this.userState.session_solves = (this.userState.session_solves || 0) + 1;
    this.userState.last_solve_epoch = Math.floor(Date.now() / 1000);

    this.solvedSet.add(problemId);
    this.saveToLocalStorage();

    const cfTr = atcoderToCodeforces(this.userState.training_rating);

    return {
      status: 'solved',
      verified: true,
      problem_id: problemId,
      solve_performance: solvePerformance,
      cf_solve_performance: cfPerf.cfRating,
      cf_title: cfPerf.title,
      training_rating: this.userState.training_rating,
      cf_training_rating: cfTr.cfRating,
      rating_delta: ratingDelta,
      par_seconds: parSeconds,
      elapsed_seconds: elapsedSeconds,
      beat_par: elapsedSeconds <= parSeconds,
      par_diff_seconds: parSeconds - elapsedSeconds,
      is_critical: isCritical,
      is_clutch: isClutch,
      speed_surge_bonus: speedSurgeBonus,
      streak: this.userState.streak,
      multiplier: this.userState.multiplier,
      xp_gained: xpGained,
      is_optimistic: Boolean(isAttested),
      primed_problem: this.getNextFlowProblem('flow')
    };
  }

  /**
   * Records a skip / abandon with user feedback and re-primes next problem.
   */
  recordSkip(problemId, reason = 'neutral') {
    const currentTr = this.userState.training_rating || 1200;
    let delta = -10;
    if (reason === 'too_hard') delta = -25;
    else if (reason === 'too_easy') delta = +25;

    const newTr = Math.max(400, Math.min(3200, currentTr + delta));
    this.userState.training_rating = newTr;
    this.saveToLocalStorage();

    const nextProblem = this.getNextFlowProblem('flow');
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
   * Directly syncs accepted submissions from Kenkoooo API (supports CORS out-of-the-box).
   */
  async syncKenkoooo() {
    const handle = this.userState.handle || 'atrv';
    const url = `https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=${encodeURIComponent(handle)}&from_second=0`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Kenkoooo HTTP ${res.status}: ${res.statusText}`);
    }

    const submissions = await res.json();
    if (!Array.isArray(submissions)) return { synced: 0, new_ac: [] };

    const newAc = [];
    for (const sub of submissions) {
      if (sub.result === 'AC' && sub.problem_id) {
        if (!this.solvedSet.has(sub.problem_id)) {
          this.solvedSet.add(sub.problem_id);
          newAc.push(sub.problem_id);
        }
      }
    }

    if (newAc.length > 0) {
      this.saveToLocalStorage();
    }

    return {
      synced: submissions.length,
      new_ac: newAc,
      total_solved: this.solvedSet.size
    };
  }

  /**
   * Directly dispatches task & samples to local CPH listener on port 27121.
   */
  async pushToCPH(problemId) {
    const problem = this.getProblem(problemId);
    if (!problem) throw new Error(`Problem ${problemId} not found`);

    const payload = {
      name: problem.title || problem.name,
      group: `AtCoder - ${(problem.contest_id || '').toUpperCase()}`,
      url: problem.url,
      interactive: false,
      memoryLimit: problem.memory_limit_mb || 1024,
      timeLimit: problem.time_limit_ms || 2000,
      tests: (problem.sample_tests || []).map(t => ({ input: t.input, output: t.output })),
      testType: "single",
      input: { type: "stdin" },
      output: { type: "stdout" },
      languages: { java: { mainClass: "Main", taskClass: problem.id } },
      batch: { id: "atcoder-flow-surge", size: 1 }
    };

    try {
      const res = await fetch('http://localhost:27121/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return { delivered: res.ok, port: 27121 };
    } catch (err) {
      return { delivered: false, port: 27121, error: err.message };
    }
  }

  /**
   * Fetches problem statement via CORS proxy or fallback.
   */
  async fetchStatement(problemId) {
    const problem = this.getProblem(problemId);
    if (!problem) return null;

    if (problem.statement_html) {
      return { statement_html: problem.statement_html, samples: problem.sample_tests || [] };
    }

    const taskUrl = problem.url || `https://atcoder.jp/contests/${problem.contest_id}/tasks/${problem.id}`;

    // Try public CORS proxies for statement scraping
    const proxies = [
      `https://corsproxy.io/?url=${encodeURIComponent(taskUrl)}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(taskUrl)}`
    ];

    for (const proxyUrl of proxies) {
      try {
        const res = await fetch(proxyUrl, { headers: { 'Accept': 'text/html' } });
        if (res.ok) {
          const html = await res.text();
          const enMatch = html.match(/<span class="lang-en">([\s\S]*?)<\/span>/i);
          if (enMatch) {
            return {
              statement_html: enMatch[1],
              samples: problem.sample_tests || []
            };
          }
        }
      } catch (_) {}
    }

    // Clean fallback markdown when proxies fail
    return {
      statement_html: `
        <div class="statement-fallback">
          <h3>${problem.title || problem.name}</h3>
          <p>Direct statement preview is blocked by cross-origin security in static mode.</p>
          <p><a href="${taskUrl}" target="_blank" rel="noopener noreferrer" class="btn-primary" style="display:inline-block; margin-top:10px;">[o] Open Task on AtCoder</a></p>
        </div>
      `,
      samples: problem.sample_tests || []
    };
  }
}

export const flowStore = new FlowStoreClass();
