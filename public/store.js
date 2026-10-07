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

/**
 * Parses a URL hash string into a structured route state object for browser history navigation.
 */
export function parseRouteHash(hashStr = '') {
  const clean = (hashStr || '').replace(/^#\/?/, '').trim();
  const [pathPart, queryPart] = clean.split('?');
  const segments = (pathPart || '').split('/').filter(Boolean);
  const params = new URLSearchParams(queryPart || '');

  const result = {
    view: 'table',
    subView: null,
    problemId: null,
    domain: params.get('domain') || null,
    category: params.get('category') || null,
    contest: params.get('contest') || null
  };

  const root = (segments[0] || 'table').toLowerCase();

  if (root === 'tree' || root === 'techtree') {
    result.view = 'techtree';
    const sub = (segments[1] || '').toLowerCase();
    result.subView = (sub === 'dag' || sub === 'domains') ? sub : null;
  } else if (root === 'problem' || root === 'zen') {
    result.view = 'zen';
    result.problemId = segments[1] ? decodeURIComponent(segments[1]) : (params.get('id') || null);
  } else {
    result.view = 'table';
  }

  return result;
}

/**
 * Builds a canonical URL hash string from a route descriptor.
 */
export function buildRouteHash(route = {}) {
  const view = route.view || 'table';
  if (view === 'techtree' || view === 'tree') {
    const sub = route.subView === 'dag' ? 'dag' : 'domains';
    return `#/tree/${sub}`;
  }
  if (view === 'zen' || view === 'problem') {
    if (route.problemId) {
      return `#/problem/${encodeURIComponent(route.problemId)}`;
    }
    return '#/zen';
  }

  const params = new URLSearchParams();
  if (route.domain && route.domain !== 'ALL') params.set('domain', route.domain);
  if (route.category && route.category !== 'ALL') params.set('category', route.category);
  if (route.contest && route.contest.toUpperCase() !== 'ALL') params.set('contest', route.contest);
  const qs = params.toString();
  return qs ? `#/table?${qs}` : '#/table';
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
      review_list: [],
      solve_log: [],
      card_collection: [],
      preferences: { muted: false, mode: 'flow', gauntlet_preset: 'escalation' }
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

    if (!Array.isArray(this.userState.review_list)) this.userState.review_list = [];
    if (!Array.isArray(this.userState.solve_log)) this.userState.solve_log = [];
    if (!Array.isArray(this.userState.card_collection)) this.userState.card_collection = [];
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
    return {
      ...this.userState,
      solved_count: this.solvedSet.size,
      review_count: (this.userState.review_list || []).length,
      card_count: (this.userState.card_collection || []).length
    };
  }

  /**
   * Returns all unlocked SFW Anime Artwork Reward Cards.
   */
  getCardCollection() {
    if (!Array.isArray(this.userState.card_collection)) this.userState.card_collection = [];
    return this.userState.card_collection;
  }

  /**
   * Deletes a card from the collection by ID.
   */
  deleteRewardCard(cardId) {
    if (!Array.isArray(this.userState.card_collection)) return;
    this.userState.card_collection = this.userState.card_collection.filter(c => c.id !== cardId);
    this.saveToLocalStorage();
  }

  /**
   * Clears all cards from the collection.
   */
  clearRewardCards() {
    this.userState.card_collection = [];
    this.saveToLocalStorage();
  }

  /**
   * Rolls a new Anime Character Artwork Card directly from Waifu.im v7 API (`https://api.waifu.im/images`)
   * and saves it to `card_collection`.
   */
  async rollRewardCard(problem = null, solveRes = null) {
    const rawDiff = problem?.clipped_difficulty ?? problem?.difficulty ?? this.userState.training_rating ?? 1200;
    const diff = Math.max(100, Math.round(rawDiff));
    let rarity = 'N // INITIATE';
    let rarityTier = 'N';
    let rarityColor = '#94a3b8';

    if (diff >= 2000 || solveRes?.is_frontier_leap) {
      rarity = 'SSR // MYTHIC';
      rarityTier = 'SSR';
      rarityColor = '#f1c40f';
    } else if (diff >= 1600 || solveRes?.beat_par) {
      rarity = 'SR // ELITE';
      rarityTier = 'SR';
      rarityColor = '#00e5ff';
    } else if (diff >= 1200) {
      rarity = 'R // VANGUARD';
      rarityTier = 'R';
      rarityColor = '#2ecc71';
    }

    const waifuImUrl = 'https://api.waifu.im/images?IsNsfw=True';
    const res = await fetch(waifuImUrl, {
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    if (!res.ok) {
      throw new Error(`Waifu.im API HTTP ${res.status}`);
    }

    const d = await res.json();
    const img = Array.isArray(d?.items) ? d.items[0] : (Array.isArray(d?.images) ? d.images[0] : null);
    if (!img || !img.url) {
      throw new Error('Waifu.im returned empty items');
    }

    const tagNames = Array.isArray(img.tags)
      ? img.tags.map(t => t.name || t.slug).filter(Boolean)
      : ['Waifu'];
    const artistName = (Array.isArray(img.artists) && img.artists[0]?.name)
      || img?.artist?.name
      || 'Waifu.im Artist';

    const cardData = {
      id: `card_${img.id || img.image_id || Date.now()}_${Math.floor(Math.random() * 1000)}`,
      imageUrl: img.url,
      fullUrl: img.url,
      rarity,
      rarityTier,
      rarityColor,
      category: tagNames[0] || 'Waifu',
      tags: tagNames.slice(0, 5),
      character: tagNames.join(' · ') || 'Waifu Illustration',
      artist: artistName,
      sourceUrl: img.source || img.url,
      problemId: problem?.id || 'bonus_roll',
      problemTitle: problem?.title || 'XP Gacha Roll',
      problemDiff: diff,
      unlockedAt: new Date().toISOString()
    };

    if (!Array.isArray(this.userState.card_collection)) {
      this.userState.card_collection = [];
    }
    this.userState.card_collection.unshift(cardData);
    if (this.userState.card_collection.length > 200) {
      this.userState.card_collection = this.userState.card_collection.slice(0, 200);
    }
    this.saveToLocalStorage();
    return cardData;
  }

  setHandle(newHandle) {
    if (!newHandle || !newHandle.trim()) return;
    this.userState.handle = newHandle.trim();
    this.saveToLocalStorage();
    return this.getUserState();
  }

  /**
   * Directly sets the user's Practice / Training Rating (100 - 3600) so they never have to grind
   * easy problems to reach their actual capability zone.
   */
  setTrainingRating(newTr) {
    const prevTr = this.userState.training_rating || 1200;
    const clamped = Math.max(100, Math.min(3600, Math.round(Number(newTr) || 1200)));
    this.userState.training_rating = clamped;
    if (!Array.isArray(this.userState.solve_log)) this.userState.solve_log = [];
    this.userState.solve_log.push({
      id: 'manual_set',
      ts: Math.floor(Date.now() / 1000),
      diff: clamped,
      elapsed: 0,
      tr_before: prevTr,
      tr_after: clamped,
      delta: clamped - prevTr,
      status: 'manual_tr'
    });
    if (this.userState.solve_log.length > 100) {
      this.userState.solve_log = this.userState.solve_log.slice(-100);
    }
    this.saveToLocalStorage();
    return {
      ...this.getUserState(),
      previous_tr: prevTr,
      new_tr: clamped,
      cf: atcoderToCodeforces(clamped)
    };
  }

  /**
   * Empirically calibrates Training Rating from the user's actual solved problems (70th percentile
   * of their top 15 solved difficulties, ignoring trivial warmups).
   */
  autoCalibrateRatingFromSolved() {
    const prevTr = this.userState.training_rating || 1200;
    const solvedDiffs = [];

    for (const id of this.solvedSet) {
      const p = this.problemMap.get(id);
      const d = p ? (p.clipped_difficulty ?? p.difficulty) : null;
      if (p && Number.isFinite(d) && d > 0) {
        solvedDiffs.push({ id: p.id, title: p.title, diff: d });
      }
    }

    if (solvedDiffs.length === 0) {
      return {
        calibrated: false,
        reason: 'No solved problems found in local state. Click [v] SYNC first or set rating manually.',
        previous_tr: prevTr,
        new_tr: prevTr,
        newTr: prevTr,
        sample_size: 0,
        sampleSize: 0,
        topPeak: 0,
        top_problems: [],
        state: this.getUserState()
      };
    }

    solvedDiffs.sort((a, b) => b.diff - a.diff);
    const topSlice = solvedDiffs.slice(0, Math.min(15, solvedDiffs.length));
    // Anchor to 30% index from top of topSlice (70th percentile of top solved tasks)
    const idx = Math.min(topSlice.length - 1, Math.floor(topSlice.length * 0.3));
    const empiricalTr = Math.max(400, Math.min(3200, Math.round(topSlice[idx].diff / 10) * 10));
    const topPeak = Math.round(topSlice[0].diff);

    this.userState.training_rating = empiricalTr;
    if (!Array.isArray(this.userState.solve_log)) this.userState.solve_log = [];
    this.userState.solve_log.push({
      id: 'auto_calibrate',
      ts: Math.floor(Date.now() / 1000),
      diff: empiricalTr,
      elapsed: 0,
      tr_before: prevTr,
      tr_after: empiricalTr,
      delta: empiricalTr - prevTr,
      status: 'auto_calibrate'
    });
    this.saveToLocalStorage();

    return {
      calibrated: true,
      previous_tr: prevTr,
      new_tr: empiricalTr,
      newTr: empiricalTr,
      sample_size: topSlice.length,
      sampleSize: topSlice.length,
      topPeak,
      top_problems: topSlice.slice(0, 5),
      cf: atcoderToCodeforces(empiricalTr),
      state: this.getUserState()
    };
  }

  saveUserPreferences(prefs) {
    this.userState.preferences = { ...this.userState.preferences, ...prefs };
    this.saveToLocalStorage();
  }

  getUserPreferences() {
    return this.userState.preferences || {};
  }

  getGauntletPreset() {
    return this.userState.preferences?.gauntlet_preset || 'escalation';
  }

  setGauntletPreset(preset = 'escalation') {
    const valid = ['escalation', 'hard_push', 'arc_deep', 'redemption'].includes(preset)
      ? preset
      : 'escalation';
    this.saveUserPreferences({ gauntlet_preset: valid });
    return valid;
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

  isInReviewQueue(problemId) {
    return Array.isArray(this.userState.review_list) && this.userState.review_list.includes(problemId);
  }

  getReviewQueueCount() {
    return Array.isArray(this.userState.review_list) ? this.userState.review_list.length : 0;
  }

  toggleReviewBookmark(problemId) {
    if (!problemId) return false;
    if (!Array.isArray(this.userState.review_list)) {
      this.userState.review_list = [];
    }
    const idx = this.userState.review_list.indexOf(problemId);
    let added = false;
    if (idx >= 0) {
      this.userState.review_list.splice(idx, 1);
      added = false;
    } else {
      this.userState.review_list.push(problemId);
      added = true;
    }
    this.saveToLocalStorage();
    return added;
  }

  hasNotes(problemId) {
    if (!problemId || typeof localStorage === 'undefined') return false;
    try {
      const val = localStorage.getItem(`atcoder_notes_${problemId}`);
      return Boolean(val && val.trim().length > 0);
    } catch (_) {
      return false;
    }
  }

  getNotesSnippet(problemId, maxLen = 110) {
    if (!problemId || typeof localStorage === 'undefined') return '';
    try {
      const val = (localStorage.getItem(`atcoder_notes_${problemId}`) || '').trim();
      if (!val) return '';
      const oneLine = val.replace(/\s+/g, ' ');
      return oneLine.length > maxLen ? oneLine.slice(0, maxLen) + '…' : oneLine;
    } catch (_) {
      return '';
    }
  }

  appendProblemNote(problemId, noteTag) {
    if (!problemId || !noteTag || typeof localStorage === 'undefined') return '';
    try {
      const key = `atcoder_notes_${problemId}`;
      const existing = localStorage.getItem(key) || '';
      if (existing.includes(noteTag)) return existing;
      const updated = existing.trim()
        ? `${existing.trim()}\n${noteTag}`
        : `${noteTag}\n`;
      localStorage.setItem(key, updated);
      return updated;
    } catch (_) {
      return '';
    }
  }

  getProblems(filters = {}) {
    let result = this.problems.map(p => ({
      ...p,
      is_solved: this.isSolved(p.id),
      in_review: this.isInReviewQueue(p.id),
      has_notes: this.hasNotes(p.id),
      notes_snippet: this.getNotesSnippet(p.id)
    }));

    if (filters.reviewOnly) {
      result = result.filter(p => p.in_review);
    }

    if (filters.notesOnly) {
      result = result.filter(p => p.has_notes);
    }

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

    // Special mode: 'review' pulls directly from the user's Spaced Repetition Review Queue (review_list)
    if (mode === 'review') {
      const reviewIds = (this.userState.review_list || []).filter(id => id !== excludeId);
      if (reviewIds.length > 0) {
        const chosenId = reviewIds[0];
        const prob = this.getProblem(chosenId);
        if (prob) return { ...prob, in_review: true };
      }
    }

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
   * Records AC solve, computes Par pacing bonuses, Fast Frontier Rating Leap for above-TR solves,
   * Up-Solve Redemption graduation from review_list, and solve_log telemetry.
   */
  recordSolve(problemId, elapsedSeconds, isAttested = true) {
    const problem = this.getProblem(problemId) || { id: problemId, clipped_difficulty: 1200 };
    const baseDiff = problem.clipped_difficulty || 1200;

    const parSeconds = Math.min(2100, Math.max(480, Math.round(600 + (baseDiff - 1000) * 1.5)));

    // Pacing vs Par: measured speed adjustment anchored to difficulty
    let speedBonus = 0;
    if (elapsedSeconds <= parSeconds) {
      speedBonus = Math.round(((parSeconds - elapsedSeconds) / parSeconds) * 75);
    } else {
      speedBonus = Math.max(-120, Math.round(((parSeconds - elapsedSeconds) / parSeconds) * 80));
    }

    const isCritical = elapsedSeconds <= 0.5 * parSeconds;
    const speedSurgeBonus = isCritical
      ? Math.min(25, Math.floor(((0.5 * parSeconds - elapsedSeconds) / (0.5 * parSeconds)) * 25))
      : 0;

    const isClutch = !isCritical && (elapsedSeconds >= 0.85 * parSeconds && elapsedSeconds <= parSeconds);

    // Honest solve performance anchored to problem difficulty
    const solvePerformance = Math.max(400, Math.round(baseDiff + speedBonus + speedSurgeBonus));
    const cfPerf = atcoderToCodeforces(solvePerformance);

    // Elo-principled Training Rating progression + Fast Frontier Leap when solving above-TR problems
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

    let ratingDelta = Math.max(1, Math.min(22, baseDelta + speedDeltaBonus));
    let isFrontierLeap = false;

    // Fast Frontier Leap: if problem difficulty is >100 above current TR, leap 35% of the gap
    // so capable users never have to grind dozens of easy problems to reach their true rating.
    if (baseDiff > currentTr + 100) {
      const frontierLeap = Math.round((baseDiff - currentTr) * 0.35) + Math.max(0, speedDeltaBonus);
      if (frontierLeap > ratingDelta) {
        ratingDelta = Math.min(350, frontierLeap);
        isFrontierLeap = true;
      }
    }

    // Check if this solve graduates a problem from the Spaced Repetition Review Queue
    let wasRedemption = false;
    if (Array.isArray(this.userState.review_list)) {
      const revIdx = this.userState.review_list.indexOf(problemId);
      if (revIdx >= 0) {
        this.userState.review_list.splice(revIdx, 1);
        wasRedemption = true;
      }
    }

    // Update state
    this.userState.training_rating = Math.round(this.userState.training_rating + ratingDelta);
    this.userState.streak = (this.userState.streak || 0) + 1;
    this.userState.multiplier = Math.min(4, 1 + Math.floor(this.userState.streak / 5) * 0.25);
    const xpGained = Math.round((baseDiff / 10) * this.userState.multiplier * (wasRedemption ? 1.5 : 1));
    this.userState.xp = (this.userState.xp || 0) + xpGained;
    this.userState.session_solves = (this.userState.session_solves || 0) + 1;
    this.userState.last_solve_epoch = Math.floor(Date.now() / 1000);

    // Append to empirical solve_log (capped at 100 entries)
    if (!Array.isArray(this.userState.solve_log)) {
      this.userState.solve_log = [];
    }
    this.userState.solve_log.push({
      id: problemId,
      title: problem.title || problemId,
      diff: baseDiff,
      domain: classifyProblemDomain(problem),
      ts: Date.now(),
      elapsed: elapsedSeconds,
      par: parSeconds,
      perf: solvePerformance,
      tr_after: this.userState.training_rating,
      delta: ratingDelta,
      status: 'ac',
      was_redemption: wasRedemption,
      is_frontier_leap: isFrontierLeap
    });
    if (this.userState.solve_log.length > 100) {
      this.userState.solve_log = this.userState.solve_log.slice(-100);
    }

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
      is_frontier_leap: isFrontierLeap,
      was_redemption: wasRedemption,
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
    const problem = this.getProblem(problemId) || { id: problemId, clipped_difficulty: 1200 };
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

    if (!Array.isArray(this.userState.solve_log)) {
      this.userState.solve_log = [];
    }
    this.userState.solve_log.push({
      id: problemId,
      title: problem.title || problemId,
      diff: problem.clipped_difficulty || 1200,
      domain: classifyProblemDomain(problem),
      ts: Date.now(),
      elapsed: elapsedSeconds,
      par: 0,
      perf: 0,
      tr_after: newTr,
      delta,
      status: 'giveup'
    });
    if (this.userState.solve_log.length > 100) {
      this.userState.solve_log = this.userState.solve_log.slice(-100);
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
   * Returns empirical telemetry summary: Rating sparkline points, 8-domain breakdown, and recent activity tape.
   */
  getTelemetrySummary() {
    const log = Array.isArray(this.userState.solve_log) ? this.userState.solve_log : [];
    const currentTr = this.userState.training_rating || 1200;
    const domains = this.getDomainSummary();

    // Build sparkline series (up to last 25 events)
    const sparkPoints = log.slice(-25).map(entry => ({
      id: entry.id,
      tr: entry.tr_after || currentTr,
      rating: entry.tr_after || currentTr,
      delta: entry.delta || 0,
      status: entry.status || 'ac',
      outcome: entry.status || 'ac',
      frontier: Boolean(entry.frontier),
      diff: entry.diff || 1200
    }));
    if (sparkPoints.length === 0) {
      sparkPoints.push({ id: 'init', tr: currentTr, rating: currentTr, delta: 0, status: 'init', outcome: 'init', frontier: false, diff: currentTr });
    }

    let notesCount = 0;
    for (const p of this.problems) {
      if (this.hasNotes(p.id)) notesCount++;
    }

    const domainStats = domains.map(d => {
      let sumDiff = 0;
      let countDiff = 0;
      for (const p of this.problems) {
        if (classifyProblemDomain(p) === d.key && this.isSolved(p.id)) {
          const pd = p.clipped_difficulty ?? p.difficulty;
          if (Number.isFinite(pd) && pd > 0) {
            sumDiff += pd;
            countDiff++;
          }
        }
      }
      return {
        key: d.key,
        name: d.name,
        icon: d.icon,
        solved: d.solved_count || 0,
        total: d.total_problems || 0,
        pct: d.mastery_percent || 0,
        avgSolvedDiff: countDiff > 0 ? Math.round(sumDiff / countDiff) : null
      };
    });

    return {
      current_tr: currentTr,
      currentRating: currentTr,
      cf: atcoderToCodeforces(currentTr),
      solved_count: this.solvedSet.size,
      totalSolved: this.solvedSet.size,
      review_count: this.getReviewQueueCount(),
      reviewCount: this.getReviewQueueCount(),
      notesCount,
      sparkline: sparkPoints,
      ratingSeries: sparkPoints,
      recent_tape: [...log].reverse().slice(0, 12),
      domains,
      domainStats
    };
  }

  /**
   * Exports all user state and per-problem scratchpad notes as a portable JSON string.
   */
  exportFullBackupJSON() {
    const notes = {};
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('atcoder_notes_')) {
          notes[k] = localStorage.getItem(k);
        }
      }
    }
    return JSON.stringify({
      version: '2.1',
      exported_at: new Date().toISOString(),
      user_state: this.getUserState(),
      notes
    }, null, 2);
  }

  /**
   * Restores user state and per-problem scratchpad notes from a backup JSON string.
   */
  importFullBackupJSON(jsonString) {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object' || !parsed.user_state) {
      throw new Error('Invalid backup JSON format');
    }
    this.userState = { ...this.userState, ...parsed.user_state };
    if (!Array.isArray(this.userState.review_list)) this.userState.review_list = [];
    if (!Array.isArray(this.userState.solve_log)) this.userState.solve_log = [];
    this.solvedSet = new Set(this.userState.solved_ids || []);
    this.saveToLocalStorage();

    let restoredNotes = 0;
    if (parsed.notes && typeof parsed.notes === 'object' && typeof localStorage !== 'undefined') {
      for (const [k, v] of Object.entries(parsed.notes)) {
        if (k.startsWith('atcoder_notes_') && typeof v === 'string') {
          localStorage.setItem(k, v);
          restoredNotes++;
        }
      }
    }
    return {
      ...this.getUserState(),
      solved: this.solvedSet.size,
      rating: this.userState.training_rating || 1200,
      restoredNotes
    };
  }

  /**
   * Fetches submissions from Kenkoooo v3 API with CloudFront cache-busting and CORS fallback.
   */
  async _fetchKenkooooSubmissions(handle, fromSecond) {
    const url = `https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=${encodeURIComponent(handle)}&from_second=${fromSecond}`;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`Kenkoooo HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (directErr) {
      // Fallback to CORS proxy if direct CloudFront edge fails
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl, { cache: 'no-store' });
      if (!res.ok) throw directErr;
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  }

  /**
   * Directly syncs accepted submissions from Kenkoooo API.
   * Queries both baseline history and a fresh 30-day rolling window (with jitter to bypass
   * CloudFront edge caching and Kenkoooo's 500-submission ascending pagination cap).
   */
  async syncKenkoooo() {
    const handle = (this.userState.handle || 'atrv').trim();
    const nowSec = Math.floor(Date.now() / 1000);
    // Unique from_second bypasses CloudFront 'Hit from cloudfront' stale cache
    const recentFrom = Math.max(0, nowSec - 86400 * 30 - (nowSec % 97) - Math.floor(Math.random() * 53));

    const [recentSubs, baseSubs] = await Promise.all([
      this._fetchKenkooooSubmissions(handle, recentFrom),
      this._fetchKenkooooSubmissions(handle, 0).catch(() => [])
    ]);

    const merged = [...baseSubs, ...recentSubs];
    const newAc = [];
    for (const sub of merged) {
      if (sub && sub.result === 'AC' && sub.problem_id) {
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
      synced: merged.length,
      new_ac: newAc,
      total_solved: this.solvedSet.size
    };
  }

  /**
   * Live-verifies a specific problem's AC status on Kenkoooo with cache-busted recent window
   * and returns rich diagnostic metadata (latest verdict, crawler lag status, handle).
   */
  async verifyProblemAC(problemId) {
    const handle = (this.userState.handle || 'atrv').trim();
    const nowSec = Math.floor(Date.now() / 1000);
    // Query last 14 days with random second offset so CloudFront MUST miss cache and hit origin
    const recentFrom = Math.max(0, nowSec - 86400 * 14 - Math.floor(Math.random() * 180));

    const recentSubs = await this._fetchKenkooooSubmissions(handle, recentFrom);

    const newAc = [];
    for (const sub of recentSubs) {
      if (sub && sub.result === 'AC' && sub.problem_id) {
        if (!this.solvedSet.has(sub.problem_id)) {
          this.solvedSet.add(sub.problem_id);
          newAc.push(sub.problem_id);
        }
      }
    }
    if (newAc.length > 0) {
      this.saveToLocalStorage();
    }

    const problemSubs = recentSubs
      .filter(s => s && s.problem_id === problemId)
      .sort((a, b) => (b.epoch_second || 0) - (a.epoch_second || 0));

    const acSub = problemSubs.find(s => s.result === 'AC');
    if (acSub || this.isSolved(problemId)) {
      return {
        verified: true,
        handle,
        latestSub: acSub || problemSubs[0] || null
      };
    }

    const latestSub = problemSubs[0] || null;
    const latestOverallSub = recentSubs.length > 0
      ? [...recentSubs].sort((a, b) => (b.epoch_second || 0) - (a.epoch_second || 0))[0]
      : null;

    return {
      verified: false,
      handle,
      reason: latestSub ? 'non_ac' : 'not_indexed_yet',
      latestSub,
      latestOverallSub
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
