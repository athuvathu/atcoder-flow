import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { CORE_DOMAINS, NODE_DOMAIN_MAP, classifyProblemDomain, flowStore } from '../../public/store.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROBLEMS_PATH = path.resolve(__dirname, '../../public/data/problems.json');

describe('Feature: Core Domains Taxonomy & General Counterpart to Micro-Tree', () => {
  let problems = [];

  before(() => {
    problems = JSON.parse(fs.readFileSync(PROBLEMS_PATH, 'utf8'));
  });

  it('case 1: should contain exactly 8 canonical core competitive programming domains', () => {
    assert.equal(CORE_DOMAINS.length, 8);
    const expectedKeys = [
      'data_structures',
      'probability',
      'dp',
      'graph',
      'math',
      'binary_search',
      'greedy',
      'strings_geometry'
    ];
    const actualKeys = CORE_DOMAINS.map(d => d.key);
    assert.deepEqual(actualKeys, expectedKeys);

    for (const domain of CORE_DOMAINS) {
      assert(domain.name, `Domain ${domain.key} missing name`);
      assert(domain.icon, `Domain ${domain.key} missing icon`);
      assert(domain.tagline, `Domain ${domain.key} missing tagline`);
      assert(Array.isArray(domain.nodeIds), `Domain ${domain.key} nodeIds must be array`);
      assert(domain.nodeIds.length > 0, `Domain ${domain.key} must link to child nodes`);
    }
  });

  it('case 2: should map all 25 tech tree nodes to one of the 8 core domains', () => {
    const validDomains = new Set(CORE_DOMAINS.map(d => d.key));
    const mappedNodes = Object.entries(NODE_DOMAIN_MAP);
    assert.equal(mappedNodes.length, 25, 'Expected 25 nodes mapped to domains');

    for (const [nodeId, domainKey] of mappedNodes) {
      assert(validDomains.has(domainKey), `Node "${nodeId}" mapped to unknown domain "${domainKey}"`);
    }
  });

  it('case 3: should correctly classify representative competitive programming problems', () => {
    // 1. Data Structures
    assert.equal(classifyProblemDomain({ category: 'range', title: 'Range Sum Queries' }), 'data_structures');
    assert.equal(classifyProblemDomain({ category: 'segment_tree', title: 'RMQ' }), 'data_structures');
    assert.equal(classifyProblemDomain({ category: 'prefix_sum', title: 'Cumulative' }), 'data_structures');

    // 2. Probability & Expectation
    assert.equal(classifyProblemDomain({ category: 'probability', title: 'Coin Tosses' }), 'probability');
    assert.equal(classifyProblemDomain({ category: 'math', sub_category: 'expectation', title: 'Dice Game' }), 'probability');
    assert.equal(classifyProblemDomain({ category: 'dp', title: 'Expected Number of Steps' }), 'probability');

    // 3. Dynamic Programming
    assert.equal(classifyProblemDomain({ category: 'dp', title: 'Knapsack 1' }), 'dp');
    assert.equal(classifyProblemDomain({ category: 'dp', sub_category: 'tree_dp', title: 'Tree Distances' }), 'dp');

    // 4. Graph Theory
    assert.equal(classifyProblemDomain({ category: 'graph', title: 'Shortest Path' }), 'graph');
    assert.equal(classifyProblemDomain({ category: 'bfs_dfs', title: 'Maze Traversal' }), 'graph');
    assert.equal(classifyProblemDomain({ category: 'dijkstra', title: 'Routing' }), 'graph');

    // 5. Binary Search & Two Pointers
    assert.equal(classifyProblemDomain({ category: 'binary_search', title: 'Buy an Integer' }), 'binary_search');
    assert.equal(classifyProblemDomain({ category: 'two_pointers', title: 'Subarray Sum' }), 'binary_search');

    // 6. Math & Number Theory
    assert.equal(classifyProblemDomain({ category: 'nt', title: 'Prime Factorization' }), 'math');
    assert.equal(classifyProblemDomain({ category: 'counting', title: 'Binomial Coefficients' }), 'math');

    // 7. Strings, Geometry & Bitwise
    assert.equal(classifyProblemDomain({ category: 'strings', title: 'String Matching' }), 'strings_geometry');
    assert.equal(classifyProblemDomain({ category: 'geometry', title: 'Convex Hull' }), 'strings_geometry');
    assert.equal(classifyProblemDomain({ category: 'bitwise', title: 'XOR Minimization' }), 'strings_geometry');

    // 8. Greedy & Constructive
    assert.equal(classifyProblemDomain({ category: 'greedy', title: 'Scheduling' }), 'greedy');
    assert.equal(classifyProblemDomain({ category: 'adhoc', title: 'Card Game' }), 'greedy');
  });

  it('case 4: should classify entire dataset of 3600+ problems across all 8 domains without error', () => {
    assert(problems.length > 3000, `Dataset must have >3000 problems, got ${problems.length}`);
    const domainCounts = {};

    for (const p of problems) {
      const d = classifyProblemDomain(p);
      domainCounts[d] = (domainCounts[d] || 0) + 1;
    }

    for (const domain of CORE_DOMAINS) {
      assert(domainCounts[domain.key] > 0, `Domain ${domain.key} must have at least 1 problem`);
    }

    // Verify expected non-trivial distributions
    assert(domainCounts['dp'] >= 500, 'DP should have >= 500 problems');
    assert(domainCounts['graph'] >= 500, 'Graph should have >= 500 problems');
    assert(domainCounts['math'] >= 300, 'Math should have >= 300 problems');
    assert(domainCounts['greedy'] >= 1000, 'Greedy should have >= 1000 problems');
    assert(domainCounts['data_structures'] >= 100, 'Data structures should have >= 100 problems');
    assert(domainCounts['probability'] >= 10, 'Probability should have >= 10 problems');
  });

  it('case 5: should return complete domain summary from flowStore.getDomainSummary', async () => {
    // Inject problem catalog into flowStore
    flowStore.problems = problems;
    flowStore.problemMap = new Map(problems.map(p => [p.id, p]));
    flowStore.techTreeNodes = CORE_DOMAINS.flatMap(d => d.nodeIds).map(id => ({
      node_id: id,
      title: id,
      category: id,
      tier: 1
    }));

    const summary = flowStore.getDomainSummary();
    assert.equal(summary.length, 8);

    for (const s of summary) {
      assert(s.total_problems > 0, `Domain ${s.key} should have > 0 problems`);
      assert(typeof s.solved_count === 'number');
      assert(typeof s.mastery_percent === 'number');
      assert(s.mastery_percent >= 0 && s.mastery_percent <= 100);
      assert(Array.isArray(s.nodes));
    }
  });

  it('case 6: should filter flow problem selection by domain', () => {
    flowStore.problems = problems;
    flowStore.problemMap = new Map(problems.map(p => [p.id, p]));

    const dpProb = flowStore.getNextFlowProblem('flow', { domainFilter: 'dp' });
    assert(dpProb, 'Must return a problem');
    assert.equal(classifyProblemDomain(dpProb), 'dp', `Expected DP problem, got ${classifyProblemDomain(dpProb)}`);

    const graphProb = flowStore.getNextFlowProblem('flow', { domainFilter: 'graph' });
    assert(graphProb, 'Must return a problem');
    assert.equal(classifyProblemDomain(graphProb), 'graph', `Expected Graph problem, got ${classifyProblemDomain(graphProb)}`);

    const mathProb = flowStore.getNextFlowProblem('flow', { domainFilter: 'math' });
    assert(mathProb, 'Must return a problem');
    assert.equal(classifyProblemDomain(mathProb), 'math', `Expected Math problem, got ${classifyProblemDomain(mathProb)}`);
  });
});
