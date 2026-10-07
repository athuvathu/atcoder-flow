import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseRouteHash, buildRouteHash } from '../../public/store.js';

describe('URL Hash Router (parseRouteHash & buildRouteHash)', () => {
  it('defaults empty or unknown hash to table view', () => {
    const r1 = parseRouteHash('');
    assert.equal(r1.view, 'table');
    assert.equal(r1.domain, null);
    assert.equal(r1.category, null);
    assert.equal(r1.contest, null);

    const r2 = parseRouteHash('#/table');
    assert.equal(r2.view, 'table');
    assert.equal(buildRouteHash(r2), '#/table');
  });

  it('round-trips filtered table routes with domain, category, and contest', () => {
    const hash = buildRouteHash({
      view: 'table',
      domain: 'dp',
      category: 'ALL',
      contest: 'ABC'
    });
    assert.equal(hash, '#/table?domain=dp&contest=ABC');

    const parsed = parseRouteHash(hash);
    assert.equal(parsed.view, 'table');
    assert.equal(parsed.domain, 'dp');
    assert.equal(parsed.category, null);
    assert.equal(parsed.contest, 'ABC');
  });

  it('round-trips tech tree routes for 8 Core Domains and 24-Skill DAG', () => {
    const domHash = buildRouteHash({ view: 'techtree', subView: 'domains' });
    assert.equal(domHash, '#/tree/domains');
    const parsedDom = parseRouteHash(domHash);
    assert.equal(parsedDom.view, 'techtree');
    assert.equal(parsedDom.subView, 'domains');

    const dagHash = buildRouteHash({ view: 'techtree', subView: 'dag' });
    assert.equal(dagHash, '#/tree/dag');
    const parsedDag = parseRouteHash(dagHash);
    assert.equal(parsedDag.view, 'techtree');
    assert.equal(parsedDag.subView, 'dag');
  });

  it('round-trips problem workspace routes (#/problem/<id>)', () => {
    const probHash = buildRouteHash({ view: 'zen', problemId: 'abc150_d' });
    assert.equal(probHash, '#/problem/abc150_d');

    const parsedProb = parseRouteHash(probHash);
    assert.equal(parsedProb.view, 'zen');
    assert.equal(parsedProb.problemId, 'abc150_d');
  });
});
