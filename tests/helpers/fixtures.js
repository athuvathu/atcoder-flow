/**
 * Shared fixtures and specifications for Adaptive AtCoder Practice Platform
 */

export const FEATURES = [
  { id: 1, name: 'Minimalist pitch-dark UI', milestone: 'M2' },
  { id: 2, name: 'Subtle vertical 40px grid', milestone: 'M2' },
  { id: 3, name: 'Monospace table layout', milestone: 'M2' },
  { id: 4, name: 'Discrete rating dots', milestone: 'M2' },
  { id: 5, name: 'Contest filters', milestone: 'M2' },
  { id: 6, name: 'Difficulty bounds slider', milestone: 'M2' },
  { id: 7, name: 'Hide Difficulty toggle', milestone: 'M2' },
  { id: 8, name: 'Single-key vim navigation', milestone: 'M2' },
  { id: 9, name: 'Algorithmic Tech Tree DAG', milestone: 'M3' },
  { id: 10, name: 'Zero-Downtime Bottleneck Priming', milestone: 'M3' },
  { id: 11, name: 'Production Velocity Gauge', milestone: 'M3' },
  { id: 12, name: 'Compounding XP Multiplier', milestone: 'M3' },
  { id: 13, name: 'Goldilocks 4% Tuning', milestone: 'M3' },
  { id: 14, name: '3-Tier Progressive Hint Ladder', milestone: 'M3' },
  { id: 15, name: 'Kenkoooo API Sync for atrv', milestone: 'M1' },
  { id: 16, name: 'Automatic AC Detection', milestone: 'M1' },
  { id: 17, name: 'Offline Bundled Dataset', milestone: 'M1' },
  { id: 18, name: 'Local SQLite Persistence', milestone: 'M1' },
  { id: 19, name: 'Procedural Web Audio Engine', milestone: 'M4' },
  { id: 20, name: 'C++23 Workspace Scaffolding', milestone: 'M4' },
  { id: 21, name: 'Sample Test Scraper & Diff Runner', milestone: 'M4' },
  { id: 22, name: 'Comprehensive Test Suite & E2E', milestone: 'M5' }
];

export const RATING_BANDS = [
  { name: 'Gray', min: -Infinity, max: 399, color: 'rgb(192, 192, 192)', hex: '#C0C0C0' },
  { name: 'Brown', min: 400, max: 799, color: 'rgb(176, 140, 86)', hex: '#B08C56' },
  { name: 'Green', min: 800, max: 1199, color: 'rgb(63, 175, 63)', hex: '#3FAF3F' },
  { name: 'Cyan', min: 1200, max: 1599, color: 'rgb(66, 224, 224)', hex: '#42E0E0' },
  { name: 'Blue', min: 1600, max: 1999, color: 'rgb(136, 136, 255)', hex: '#8888FF' },
  { name: 'Yellow', min: 2000, max: 2399, color: 'rgb(255, 255, 86)', hex: '#FFFF56' },
  { name: 'Orange', min: 2400, max: 2799, color: 'rgb(255, 184, 54)', hex: '#FFB836' },
  { name: 'Red', min: 2800, max: 3199, color: 'rgb(255, 103, 103)', hex: '#FF6767' },
  { name: 'Bronze', min: 3200, max: 3599, color: 'rgb(150, 92, 44)', hex: '#965C2C', metallic: true },
  { name: 'Silver', min: 3600, max: 3999, color: 'rgb(128, 128, 128)', hex: '#808080', metallic: true },
  { name: 'Gold', min: 4000, max: Infinity, color: 'rgb(255, 215, 0)', hex: '#FFD700', metallic: true }
];

export function clipDifficulty(difficulty) {
  if (difficulty === null || difficulty === undefined) return null;
  if (difficulty >= 400) return Math.round(difficulty);
  return Math.round(400 / Math.exp(1.0 - difficulty / 400));
}

export function getRatingBand(difficulty) {
  const diff = clipDifficulty(difficulty);
  if (diff === null) return null;
  for (const band of RATING_BANDS) {
    if (diff >= band.min && diff <= band.max) {
      return band;
    }
  }
  return RATING_BANDS[0];
}

export function calculateDotFill(difficulty) {
  const d = clipDifficulty(difficulty);
  if (d === null || d <= 0) return 0;
  const bandStart = Math.floor(d / 400) * 400;
  return Math.round(Math.min((d - bandStart) / 400, 1) * 100);
}

export const TECH_TREE_NODES = [
  // Tier 1
  { id: 'math_basics', title: 'Divisibility & Math Basics', tier: 1, category: 'nt', prereqs: [], required_solves: 3 },
  { id: 'prefix_sums', title: 'Prefix Sums & Accumulation', tier: 1, category: 'prefix_sum', prereqs: [], required_solves: 3 },
  { id: 'two_pointers', title: 'Two Pointers & Sliding Window', tier: 1, category: 'two_pointers', prereqs: [], required_solves: 3 },
  { id: 'greedy_basics', title: 'Greedy Invariants', tier: 1, category: 'greedy', prereqs: [], required_solves: 3 },
  { id: 'bitwise_ops', title: 'Bitwise Logic & Masks', tier: 1, category: 'bitwise', prereqs: [], required_solves: 3 },

  // Tier 2
  { id: 'binary_search', title: 'Binary Search on Monotone Predicate', tier: 2, category: 'binary_search', prereqs: ['two_pointers'], required_solves: 4 },
  { id: 'bfs_dfs', title: 'Graph Traversal (BFS / DFS)', tier: 2, category: 'bfs_dfs', prereqs: ['bitwise_ops'], required_solves: 4 },
  { id: 'coord_compression', title: 'Coordinate Compression', tier: 2, category: 'sorting', prereqs: ['prefix_sums'], required_solves: 4 },
  { id: 'modular_arithmetic', title: 'Modular Arithmetic & Inverses', tier: 2, category: 'nt', prereqs: ['math_basics'], required_solves: 4 },
  { id: 'linear_dp', title: '1D / Linear Dynamic Programming', tier: 2, category: 'dp', prereqs: ['greedy_basics'], required_solves: 4 },

  // Tier 3
  { id: 'dijkstra', title: 'Dijkstra Shortest Path', tier: 3, category: 'dijkstra', prereqs: ['bfs_dfs'], required_solves: 4 },
  { id: 'topological_sort', title: 'DAG & Topological Sort', tier: 3, category: 'graph', prereqs: ['bfs_dfs'], required_solves: 4 },
  { id: 'dp_knapsack', title: 'Knapsack & Subset DP', tier: 3, category: 'dp', prereqs: ['linear_dp'], required_solves: 4 },
  { id: 'dp_trees', title: 'Tree Dynamic Programming', tier: 3, category: 'dp', prereqs: ['linear_dp', 'bfs_dfs'], required_solves: 4 },
  { id: 'union_find', title: 'Disjoint Set Union (DSU)', tier: 3, category: 'graph', prereqs: ['bfs_dfs'], required_solves: 4 },

  // Tier 4
  { id: 'segment_tree', title: 'Segment Tree Point Updates', tier: 4, category: 'segment_tree', prereqs: ['coord_compression'], required_solves: 5 },
  { id: 'scc_tarjan', title: 'Strongly Connected Components', tier: 4, category: 'graph', prereqs: ['topological_sort'], required_solves: 5 },
  { id: 'meet_in_middle', title: 'Meet-in-the-Middle', tier: 4, category: 'binary_search', prereqs: ['binary_search'], required_solves: 5 },
  { id: 'dp_bitmask', title: 'Bitmask Dynamic Programming', tier: 4, category: 'dp', prereqs: ['dp_knapsack', 'bitwise_ops'], required_solves: 5 },
  { id: 'flow_dinic', title: 'Max Flow & Min Cut', tier: 4, category: 'graph', prereqs: ['dijkstra', 'bfs_dfs'], required_solves: 5 },

  // Tier 5
  { id: 'lazy_segtree', title: 'Lazy Propagation Segment Tree', tier: 5, category: 'range', prereqs: ['segment_tree'], required_solves: 5 },
  { id: 'heavy_light_decomp', title: 'Heavy-Light Decomposition', tier: 5, category: 'range', prereqs: ['segment_tree', 'dp_trees'], required_solves: 5 },
  { id: 'suffix_automaton', title: 'Suffix Automaton & Strings', tier: 5, category: 'range', prereqs: ['scc_tarjan'], required_solves: 5 },
  { id: 'min_cost_flow', title: 'Min-Cost Max-Flow', tier: 5, category: 'graph', prereqs: ['flow_dinic'], required_solves: 5 },
  { id: 'fft_convolution', title: 'Fast Fourier Transform / NTT', tier: 5, category: 'nt', prereqs: ['modular_arithmetic'], required_solves: 5 }
];

export const SAMPLE_PROBLEMS = [
  {
    id: 'abc360_e',
    contest_id: 'abc360',
    problem_index: 'E',
    title: 'Random Swaps and Problem',
    difficulty: 1249,
    category: 'dp',
    sub_category: 'expected_value',
    hints: [
      'Focus on the probability of the black ball being at position 1 vs any of the other N-1 positions.',
      'Notice the symmetry: all positions 2..N have identical probability at each step. Formulate a 2-state DP.',
      'O(K) transitions with modular inverse arithmetic for division by N*(N-1)/2.'
    ],
    sample_tests: [
      { input: '2 1\n', output: '499122178\n' },
      { input: '3 2\n', output: '499122179\n' }
    ]
  },
  {
    id: 'abc326_e',
    contest_id: 'abc326',
    problem_index: 'E',
    title: 'Revenge of The Salary',
    difficulty: 1363,
    category: 'dp',
    sub_category: 'probabilities',
    hints: [
      'Work backwards from dice roll states or analyze the expected contribution of each salary item.',
      'Let P_i be the probability that salary A_i is collected. How does P_i relate to previous rolls?',
      'Suffix sum optimization yields O(N) runtime instead of O(N^2).'
    ],
    sample_tests: [
      { input: '3\n3 2 6\n', output: '499122183\n' }
    ]
  },
  {
    id: 'abc350_e',
    contest_id: 'abc350',
    problem_index: 'E',
    title: 'Toward 0',
    difficulty: 1385,
    category: 'dp',
    sub_category: 'memoization',
    hints: [
      'Two transitions: deterministic division by A, or stochastic division by 1..6 with self-loop on roll=1.',
      'Eliminate the self-loop algebraically: E(N) = (B + sum_{b=2..6} E(floor(N/b)) / 6) * (6/5).',
      'Number of distinct reachable states floor(N / x) is at most 2 * sqrt(N). Use memoized recursion.'
    ],
    sample_tests: [
      { input: '100 2 10 20\n', output: '62.77777777777778\n' }
    ]
  },
  {
    id: 'abc250_e',
    contest_id: 'abc250',
    problem_index: 'E',
    title: 'Prefix Equality',
    difficulty: 1421,
    category: 'prefix_sum',
    sub_category: 'hashing',
    hints: [
      'Two sets of numbers are identical iff their distinct elements are identical.',
      'Assign each unique value a random 64-bit Zobrist hash. Prefix sets can be compared by XOR or sum hash.',
      'Precompute prefix hashes in O(N) using std::mt19937_64. Answer queries in O(1).'
    ],
    sample_tests: [
      { input: '5\n1 2 3 4 5\n1 2 2 4 3\n3\n1 1\n2 2\n3 5\n', output: 'Yes\nYes\nNo\n' }
    ]
  },
  {
    id: 'arc225_a',
    contest_id: 'arc225',
    problem_index: 'A',
    title: 'Digit Permutation Game',
    difficulty: 1050,
    category: 'greedy',
    sub_category: 'game_theory',
    hints: [
      'Analyze the win condition for the last player who can force the parity.',
      'Greedy choice on dominant digits.',
      'O(N log N) sorting step.'
    ],
    sample_tests: [
      { input: '4\n1 3 2 4\n', output: 'First\n' }
    ]
  }
];

export const ATRV_SEED_SUBMISSIONS = [
  { id: 77106861, epoch_second: 1782894238, problem_id: 'abc464_e', contest_id: 'abc464', user_id: 'atrv', language: 'C++23 (GCC 15.2.0)', point: 450.0, length: 1877, result: 'AC', execution_time: 474 },
  { id: 77106800, epoch_second: 1782894000, problem_id: 'abc466_e', contest_id: 'abc466', user_id: 'atrv', language: 'C++23 (GCC 15.2.0)', point: 500.0, length: 2100, result: 'AC', execution_time: 512 },
  { id: 77106750, epoch_second: 1782893500, problem_id: 'abc466_f', contest_id: 'abc466', user_id: 'atrv', language: 'C++23 (GCC 15.2.0)', point: 550.0, length: 2400, result: 'AC', execution_time: 600 },
  { id: 77106700, epoch_second: 1782893000, problem_id: 'abc360_e', contest_id: 'abc360', user_id: 'atrv', language: 'C++23 (GCC 15.2.0)', point: 450.0, length: 1950, result: 'AC', execution_time: 480 },
  { id: 77106650, epoch_second: 1782892500, problem_id: 'abc326_e', contest_id: 'abc326', user_id: 'atrv', language: 'C++23 (GCC 15.2.0)', point: 475.0, length: 1700, result: 'AC', execution_time: 420 },
  { id: 77106600, epoch_second: 1782892000, problem_id: 'abc350_e', contest_id: 'abc350', user_id: 'atrv', language: 'C++23 (GCC 15.2.0)', point: 500.0, length: 2200, result: 'AC', execution_time: 510 },
  { id: 77106550, epoch_second: 1782891500, problem_id: 'abc250_e', contest_id: 'abc250', user_id: 'atrv', language: 'C++23 (GCC 15.2.0)', point: 500.0, length: 1900, result: 'AC', execution_time: 490 },
  { id: 77106500, epoch_second: 1782891000, problem_id: 'abc465_d', contest_id: 'abc465', user_id: 'atrv', language: 'C++23 (GCC 15.2.0)', point: 400.0, length: 1600, result: 'AC', execution_time: 350 },
  { id: 77106450, epoch_second: 1782890500, problem_id: 'abc466_a', contest_id: 'abc466', user_id: 'atrv', language: 'C++23 (GCC 15.2.0)', point: 100.0, length: 500, result: 'AC', execution_time: 15 },
  { id: 77106400, epoch_second: 1782890000, problem_id: 'abc466_b', contest_id: 'abc466', user_id: 'atrv', language: 'C++23 (GCC 15.2.0)', point: 200.0, length: 800, result: 'AC', execution_time: 25 },
  { id: 77106350, epoch_second: 1782889500, problem_id: 'abc466_c', contest_id: 'abc466', user_id: 'atrv', language: 'C++23 (GCC 15.2.0)', point: 300.0, length: 1200, result: 'AC', execution_time: 110 },
  { id: 77106300, epoch_second: 1782889000, problem_id: 'abc466_d', contest_id: 'abc466', user_id: 'atrv', language: 'C++23 (GCC 15.2.0)', point: 400.0, length: 1500, result: 'AC', execution_time: 280 },
  { id: 77106250, epoch_second: 1782888500, problem_id: 'arc225_a', contest_id: 'arc225', user_id: 'atrv', language: 'C++23 (GCC 15.2.0)', point: 300.0, length: 1400, result: 'AC', execution_time: 180 },
  { id: 77106200, epoch_second: 1782888000, problem_id: 'arc225_b', contest_id: 'arc225', user_id: 'atrv', language: 'C++23 (GCC 15.2.0)', point: 500.0, length: 2200, result: 'AC', execution_time: 520 },
  // Non-AC submissions
  { id: 77106150, epoch_second: 1782887500, problem_id: 'abc350_e', contest_id: 'abc350', user_id: 'atrv', language: 'C++23 (GCC 15.2.0)', point: 0.0, length: 2150, result: 'WA', execution_time: 530 },
  { id: 77106100, epoch_second: 1782887000, problem_id: 'abc350_e', contest_id: 'abc350', user_id: 'atrv', language: 'C++23 (GCC 15.2.0)', point: 0.0, length: 2100, result: 'TLE', execution_time: 2050 }
];

export const CPP23_FAST_IO_BOILERPLATE = `#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <ranges>
#include <numeric>
#include <map>
#include <set>
#include <queue>

using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(nullptr);

    // Flow State practice solution
    return 0;
}
`;
