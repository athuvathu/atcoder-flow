import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TECH_TREE_NODES } from '../helpers/fixtures.js';

describe('Feature 9: Algorithmic Tech Tree DAG & Progression', () => {
  it('case 1: should contain exactly 25 curated algorithmic skill nodes across 5 tiers', () => {
    assert.equal(TECH_TREE_NODES.length, 25);
    for (let tier = 1; tier <= 5; tier++) {
      const nodesInTier = TECH_TREE_NODES.filter(n => n.tier === tier);
      assert.equal(nodesInTier.length, 5, `Tier ${tier} must have exactly 5 nodes`);
    }
  });

  it('case 2: should ensure all prerequisite IDs reference valid registered nodes', () => {
    const nodeIds = new Set(TECH_TREE_NODES.map(n => n.id));
    for (const node of TECH_TREE_NODES) {
      for (const prereq of node.prereqs) {
        assert(nodeIds.has(prereq), `Prerequisite "${prereq}" of node "${node.id}" is not in TECH_TREE_NODES`);
      }
    }
  });

  it('case 3: should verify the tech tree forms a strict Directed Acyclic Graph (DAG) with no cycles', () => {
    const adj = new Map();
    const inDegree = new Map();
    TECH_TREE_NODES.forEach(n => {
      adj.set(n.id, []);
      inDegree.set(n.id, 0);
    });

    TECH_TREE_NODES.forEach(n => {
      for (const p of n.prereqs) {
        adj.get(p).push(n.id);
        inDegree.set(n.id, inDegree.get(n.id) + 1);
      }
    });

    const queue = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(id);
    }

    let visitedCount = 0;
    while (queue.length > 0) {
      const curr = queue.shift();
      visitedCount++;
      for (const neighbor of adj.get(curr)) {
        inDegree.set(neighbor, inDegree.get(neighbor) - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    assert.equal(visitedCount, 25, 'Cycle detected in tech tree DAG!');
  });

  it('case 4: should unlock higher-tier nodes only when all prerequisite thresholds are met', () => {
    function computeNodeStatus(node, solvesMap) {
      if (node.tier === 1) {
        const solves = solvesMap.get(node.id) || 0;
        return solves >= node.required_solves ? 'mastered' : 'available';
      }
      // Check if all prereqs are mastered
      const allPrereqsMastered = node.prereqs.every(p => {
        const pNode = TECH_TREE_NODES.find(n => n.id === p);
        const pSolves = solvesMap.get(p) || 0;
        return pSolves >= pNode.required_solves;
      });

      if (!allPrereqsMastered) return 'locked';
      const solves = solvesMap.get(node.id) || 0;
      return solves >= node.required_solves ? 'mastered' : 'available';
    }

    const solvesMap = new Map();
    // Initially Tier 2 binary_search is locked
    const bsNode = TECH_TREE_NODES.find(n => n.id === 'binary_search');
    assert.equal(computeNodeStatus(bsNode, solvesMap), 'locked');

    // Solve 3 problems in two_pointers (prereq of binary_search)
    solvesMap.set('two_pointers', 3);
    assert.equal(computeNodeStatus(bsNode, solvesMap), 'available');

    // Solve 4 problems in binary_search
    solvesMap.set('binary_search', 4);
    assert.equal(computeNodeStatus(bsNode, solvesMap), 'mastered');
  });

  it('case 5: should correctly identify active bottleneck node in a branch', () => {
    function findActiveBottleneck(branchNodes, solvesMap) {
      for (const node of branchNodes) {
        const solves = solvesMap.get(node.id) || 0;
        if (solves < node.required_solves) {
          return node.id;
        }
      }
      return null;
    }

    const branch = [
      TECH_TREE_NODES.find(n => n.id === 'prefix_sums'),
      TECH_TREE_NODES.find(n => n.id === 'coord_compression'),
      TECH_TREE_NODES.find(n => n.id === 'segment_tree')
    ];

    const solves = new Map([['prefix_sums', 3]]);
    const bottleneck = findActiveBottleneck(branch, solves);
    assert.equal(bottleneck, 'coord_compression');
  });
});
