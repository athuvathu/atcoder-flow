// Client-Side In-Memory Data Store & Game Engine for AtCoder Flow
// 100% Static & Surge-Compatible — No Node.js backend required!

import { atcoderToCodeforces } from './rating.js';

export const CORE_DOMAINS = [
  {
    key: 'data_structures',
    name: 'Data Structures',
    icon: '⛁',
    tagline: 'Segment Trees, BIT, DSU, Priority Queues & Range Queries',
    nodeIds: ['prefix_sums', 'coord_compression', 'union_find', 'segment_tree', 'lazy_segtree', 'heavy_light_decomp']
  },
  {
    key: 'probability',
    name: 'Probability & Expectation',
    icon: '🎲',
    tagline: 'Linearity of Expectation, Expected Value DP, Random Variables',
    nodeIds: ['math_basics', 'linear_dp']
  },
  {
    key: 'dp',
    name: 'Dynamic Programming',
    icon: '⚡',
    tagline: 'Linear DP, Knapsack, Tree DP, Bitmask & State Compression',
    nodeIds: ['linear_dp', 'dp_knapsack', 'dp_trees', 'dp_bitmask']
  },
  {
    key: 'graph',
    name: 'Graph Theory & Flows',
    icon: '🕸',
    tagline: 'BFS/DFS, Dijkstra, Topological Sort, SCC, Max Flow & Min Cut',
    nodeIds: ['bfs_dfs', 'dijkstra', 'topological_sort', 'scc_tarjan', 'flow_dinic', 'min_cost_flow']
  },
  {
    key: 'math',
    name: 'Math & Number Theory',
    icon: '∑',
    tagline: 'Divisibility, Modular Inverses, Combinatorics, Primes, FFT/NTT',
    nodeIds: ['math_basics', 'modular_arithmetic', 'fft_convolution']
  },
  {
    key: 'binary_search',
    name: 'Binary Search & Two Pointers',
    icon: '⇲',
    tagline: 'Monotone Predicates, Sliding Window, Coordinate Compression, Meet-in-the-Middle',
    nodeIds: ['two_pointers', 'binary_search', 'meet_in_middle']
  },
  {
    key: 'greedy',
    name: 'Greedy & Constructive',
    icon: '⚔',
    tagline: 'Greedy Invariants, Exchange Arguments, Ad-Hoc Logic, Games',
    nodeIds: ['greedy_basics']
  },
  {
    key: 'strings_geometry',
    name: 'Strings, Geometry & Bitwise',
    icon: '∡',
    tagline: 'Suffix Automaton, String Hashing, Computational Geometry, Bitmasks',
    nodeIds: ['bitwise_ops', 'suffix_automaton']
  }
];

export const NODE_DOMAIN_MAP = {
  math_basics: 'math',
  prefix_sums: 'data_structures',
  two_pointers: 'binary_search',
  greedy_basics: 'greedy',
  bitwise_ops: 'strings_geometry',
  binary_search: 'binary_search',
  bfs_dfs: 'graph',
  coord_compression: 'binary_search',
  modular_arithmetic: 'math',
  linear_dp: 'dp',
  dijkstra: 'graph',
  topological_sort: 'graph',
  dp_knapsack: 'dp',
  dp_trees: 'dp',
  union_find: 'data_structures',
  segment_tree: 'data_structures',
  scc_tarjan: 'graph',
  meet_in_middle: 'binary_search',
  dp_bitmask: 'dp',
  flow_dinic: 'graph',
  lazy_segtree: 'data_structures',
  heavy_light_decomp: 'data_structures',
  suffix_automaton: 'strings_geometry',
  min_cost_flow: 'graph',
  fft_convolution: 'math'
};

export function classifyProblemDomain(p) {
  if (!p) return 'greedy';
  const c = (p.category || '').toLowerCase();
  const sc = (p.sub_category || '').toLowerCase();
  const t = (p.title || '').toLowerCase();

  // 1. Probability & Expectation (check first for high specificity)
  if (
    c === 'probability' ||
    sc.includes('probability') ||
    sc.includes('expectation') ||
    t.includes('expected') ||
    t.includes('expectation') ||
    t.includes('probability')
  ) {
    return 'probability';
  }

  // 2. Data Structures
  if (
    c === 'range' || c === 'segment_tree' || c === 'prefix_sum' ||
    sc.includes('segment') || sc.includes('fenwick') || sc.includes('heap') || 
    sc.includes('disjoint') || sc.includes('dsu') || sc.includes('queue') || 
    sc.includes('deque') || sc.includes('stack') || sc.includes('range') ||
    t.includes('segment tree') || t.includes('fenwick')
  ) {
    return 'data_structures';
  }

  // 3. Dynamic Programming
  if (
    c === 'dp' ||
    sc.includes('dp') ||
    sc.includes('knapsack') ||
    sc.includes('dynamic programming') ||
    t.includes('dp') ||
    t.includes('knapsack')
  ) {
    return 'dp';
  }

  // 4. Graph Theory & Flows
  if (
    c === 'graph' || c === 'dijkstra' || c === 'bfs_dfs' ||
    sc.includes('bfs') || sc.includes('dfs') || sc.includes('shortest path') || 
    sc.includes('tree') || sc.includes('spanning') || sc.includes('mst') || 
    sc.includes('bridge') || sc.includes('matching') || sc.includes('flow') || 
    sc.includes('topological') || sc.includes('tarjan')
  ) {
    return 'graph';
  }

  // 5. Binary Search & Two Pointers
  if (
    c === 'binary_search' || c === 'two_pointers' ||
    sc.includes('binary search') || sc.includes('two pointers') || 
    sc.includes('sliding window') || sc.includes('meet-in-the-middle') || 
    sc.includes('coordinate compression')
  ) {
    return 'binary_search';
  }

  // 6. Math & Number Theory
  if (
    c === 'nt' || c === 'counting' ||
    sc.includes('divisibility') || sc.includes('factorization') || 
    sc.includes('modular') || sc.includes('combinatorics') || 
    sc.includes('prime') || sc.includes('fft') || sc.includes('ntt') || 
    sc.includes('generating function') || sc.includes('inclusion')
  ) {
    return 'math';
  }

  // 7. Strings, Geometry & Bitwise
  if (
    c === 'strings' || c === 'geometry' || c === 'bitwise' ||
    sc.includes('string') || sc.includes('kmp') || sc.includes('suffix') || 
    sc.includes('geometry') || sc.includes('bitwise') || sc.includes('bitmask')
  ) {
    return 'strings_geometry';
  }

  // 8. Greedy & Constructive ad-hoc
  return 'greedy';
}

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

  getDiffOffset() {
    return Number(this.userState.preferences?.diff_offset) || 0;
  }

  setDiffOffset(offset) {
    const num = Math.max(-800, Math.min(1200, Number(offset) || 0));
    this.saveUserPreferences({ diff_offset: num });
    return num;
  }

  bumpDiffOffset(step = 50) {
    return this.setDiffOffset(this.getDiffOffset() + step);
  }

  getContestFilter() {
    return (this.userState.preferences?.contest_filter || 'all').toLowerCase();
  }

  setContestFilter(type = 'all') {
    const valid = ['all', 'abc', 'arc', 'agc'].includes((type || '').toLowerCase())
      ? type.toLowerCase()
      : 'all';
    this.saveUserPreferences({ contest_filter: valid });
    return valid;
  }

  getDomainFilter() {
    return this.userState.preferences?.domain_filter || null;
  }

  setDomainFilter(domain = null) {
    const val = (domain && domain !== 'ALL') ? domain : null;
    this.saveUserPreferences({ domain_filter: val });
    return val;
  }

  isSolved(problemId) {
    return this.solvedSet.has(problemId);
  }

  getProblems(filters = {}) {
    let result = this.problems.map(p => ({
      ...p,
      is_solved: this.isSolved(p.id)
    }));

    if (filters.domain && filters.domain !== 'ALL') {
      result = result.filter(p => classifyProblemDomain(p) === filters.domain);
    }

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
      const nodeId = node.node_id || node.id;
      const solved = solvedCounts[node.category] || 0;
      const total = node.total_problems || 50;
      const parentDomain = NODE_DOMAIN_MAP[nodeId] || classifyProblemDomain({ category: node.category });
      return {
        ...node,
        parent_domain: parentDomain,
        solved_count: solved,
        is_unlocked: true,
        mastery_percent: Math.min(100, Math.round((solved / Math.max(1, total)) * 100))
      };
    });
  }

  getDomainSummary() {
    const treeNodes = this.getTechTree();
    const domainCounts = {};
    const domainSolved = {};

    for (const p of this.problems) {
      const d = classifyProblemDomain(p);
      domainCounts[d] = (domainCounts[d] || 0) + 1;
      if (this.isSolved(p.id)) {
        domainSolved[d] = (domainSolved[d] || 0) + 1;
      }
    }

    return CORE_DOMAINS.map(domain => {
      const total = domainCounts[domain.key] || 0;
      const solved = domainSolved[domain.key] || 0;
      const mastery = total > 0 ? Math.min(100, Math.round((solved / total) * 100)) : 0;
      const childNodes = treeNodes.filter(n => (n.parent_domain || NODE_DOMAIN_MAP[n.node_id || n.id]) === domain.key);

      return {
        ...domain,
        total_problems: total,
        solved_count: solved,
        mastery_percent: mastery,
        nodes: childNodes
      };
    });
  }

  /**
   * Only-Bangers Golden Era Problem Selection Engine (ABC 150+, ARC 100+, DP).
   * Supports manual difficulty bump offset, contest filter (ALL, ABC, ARC, AGC), and domain drill.
   */
  getNextFlowProblem(mode = 'flow', options = {}) {
    const rawTr = this.userState.training_rating || 1200;
    const diffOffset = (options.diffOffset !== undefined) ? options.diffOffset : this.getDiffOffset();
    const contestFilter = (options.contestFilter !== undefined) ? options.contestFilter.toLowerCase() : this.getContestFilter();
    const domainFilter = (options.domainFilter !== undefined) ? options.domainFilter : this.getDomainFilter();
    const excludeId = options.excludeId || null;

    const tr = Math.max(400, rawTr + diffOffset);

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

    // Matcher for contest type and Golden Era standards
    const matchesContest = (contestId) => {
      const c = (contestId || '').toLowerCase();
      if (contestFilter === 'abc') {
        const num = parseInt(c.slice(3), 10);
        return c.startsWith('abc') && !isNaN(num) && num >= 150;
      }
      if (contestFilter === 'arc') {
        const num = parseInt(c.slice(3), 10);
        return c.startsWith('arc') && !isNaN(num) && num >= 100;
      }
      if (contestFilter === 'agc') {
        return c.startsWith('agc');
      }
      // 'all' includes modern ABC, modern ARC, AGC, and Educational DP
      if (c === 'dp' || c.startsWith('agc')) return true;
      if (c.startsWith('abc')) {
        const num = parseInt(c.slice(3), 10);
        return !isNaN(num) && num >= 150;
      }
      if (c.startsWith('arc')) {
        const num = parseInt(c.slice(3), 10);
        return !isNaN(num) && num >= 100;
      }
      return false;
    };

    const matchesDomain = (prob) => {
      if (!domainFilter || domainFilter === 'ALL') return true;
      return classifyProblemDomain(prob) === domainFilter;
    };

    // Filter to Golden Era candidates matching bounds, contest, and domain
    let candidates = this.problems.filter(p => {
      if (this.isSolved(p.id)) return false;
      if (excludeId && p.id === excludeId) return false;

      const diff = p.clipped_difficulty || 1200;
      if (diff < minDiff || diff > maxDiff) return false;

      return matchesContest(p.contest_id) && matchesDomain(p);
    });

    // Graceful fallback 1: Expand difficulty bounds by +/- 150 within requested contest & domain
    if (candidates.length === 0) {
      candidates = this.problems.filter(p => {
        if (this.isSolved(p.id)) return false;
        if (excludeId && p.id === excludeId) return false;
        const diff = p.clipped_difficulty || 1200;
        if (diff < minDiff - 150 || diff > maxDiff + 150) return false;
        return matchesContest(p.contest_id) && matchesDomain(p);
      });
    }

    // Graceful fallback 2: Any unsolved problem in requested contest & domain
    if (candidates.length === 0) {
      candidates = this.problems.filter(p => {
        if (this.isSolved(p.id)) return false;
        if (excludeId && p.id === excludeId) return false;
        return matchesContest(p.contest_id) && matchesDomain(p);
      });
    }

    // Graceful fallback 3: Any unsolved problem in domain across all contests
    if (candidates.length === 0 && domainFilter && domainFilter !== 'ALL') {
      candidates = this.problems.filter(p => {
        if (this.isSolved(p.id)) return false;
        if (excludeId && p.id === excludeId) return false;
        return matchesDomain(p);
      });
    }

    // Ultimate fallback if entire requested contest/domain is exhausted
    if (candidates.length === 0) {
      const fallback = this.problems.filter(p => !this.isSolved(p.id) && (!excludeId || p.id !== excludeId));
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
   * Records a problem surrender / give-up: resets streak, recalibrates rating honestly,
   * tags problem for spaced repetition review, and primes next flow problem.
   */
  recordGiveUp(problemId, elapsedSeconds = 0) {
    const currentTr = this.userState.training_rating || 1200;
    const delta = -20;
    const newTr = Math.max(400, Math.min(3200, currentTr + delta));

    this.userState.training_rating = newTr;
    this.userState.streak = 0;
    this.userState.multiplier = 1.0;

    // Track in review list for spaced repetition
    if (!Array.isArray(this.userState.review_list)) {
      this.userState.review_list = [];
    }
    if (problemId && !this.userState.review_list.includes(problemId)) {
      this.userState.review_list.push(problemId);
    }

    this.saveToLocalStorage();

    const nextProblem = this.getNextFlowProblem('flow');
    return {
      status: 'given_up',
      reason: 'surrendered',
      problem_id: problemId,
      previous_tr: currentTr,
      new_tr: newTr,
      delta,
      streak: 0,
      multiplier: 1.0,
      elapsed_seconds: elapsedSeconds,
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
