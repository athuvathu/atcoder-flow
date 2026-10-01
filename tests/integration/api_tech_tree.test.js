import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ensureServer, closeServer } from '../helpers/test_server.js';

describe('Integration: GET /api/tech-tree (25-Node Algorithmic Skill DAG)', () => {
  let baseUrl;

  before(async () => {
    baseUrl = await ensureServer();
  });

  after(async () => {
    await closeServer();
  });

  it('case 1: should return all 25 tech tree nodes with HTTP 200', async () => {
    const res = await fetch(`${baseUrl}/api/tech-tree`);
    assert.equal(res.status, 200);
    const nodes = await res.json();
    assert(Array.isArray(nodes));
    assert.equal(nodes.length, 25, `Expected 25 tech tree nodes, got ${nodes.length}`);
  });

  it('case 2: should ensure each node contains mandatory schema fields', async () => {
    const res = await fetch(`${baseUrl}/api/tech-tree`);
    const nodes = await res.json();
    for (const node of nodes) {
      assert(node.node_id, 'Must contain node_id');
      assert(node.title, 'Must contain title');
      assert(typeof node.tier === 'number', 'Tier must be a number');
      assert(node.category, 'Must contain category');
      assert('status' in node, 'Must contain status');
      assert(Array.isArray(node.prereqs), 'Prereqs must be an array');
    }
  });

  it('case 3: should verify all Tier 1 nodes are immediately accessible (available or mastered)', async () => {
    const res = await fetch(`${baseUrl}/api/tech-tree`);
    const nodes = await res.json();
    const tier1Nodes = nodes.filter(n => n.tier === 1);
    assert.equal(tier1Nodes.length, 5);
    for (const n of tier1Nodes) {
      assert(n.status === 'available' || n.status === 'mastered', `Tier 1 node ${n.node_id} must not be locked`);
    }
  });

  it('case 4: should verify valid node status enumeration values', async () => {
    const res = await fetch(`${baseUrl}/api/tech-tree`);
    const nodes = await res.json();
    const validStatuses = new Set(['locked', 'available', 'mastered']);
    for (const node of nodes) {
      assert(validStatuses.has(node.status), `Invalid status ${node.status} on node ${node.node_id}`);
    }
  });

  it('case 5: should verify prerequisite relationships connect valid lower-tier nodes', async () => {
    const res = await fetch(`${baseUrl}/api/tech-tree`);
    const nodes = await res.json();
    const nodeMap = new Map(nodes.map(n => [n.node_id, n]));

    for (const node of nodes) {
      for (const p of node.prereqs) {
        assert(nodeMap.has(p), `Prerequisite ${p} not found in node catalog`);
        const parentNode = nodeMap.get(p);
        assert(parentNode.tier <= node.tier, `Prerequisite tier ${parentNode.tier} must be <= child tier ${node.tier}`);
      }
    }
  });
});
