import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ensureServer, closeServer } from '../helpers/test_server.js';

describe('Integration: /api/workspace (Local C++23 Scaffolding & Diff Runner)', () => {
  let baseUrl;
  const testProblemId = 'abc360_e';

  before(async () => {
    baseUrl = await ensureServer();
  });

  after(async () => {
    await closeServer();
  });

  it('case 1: should scaffold problem workspace and create C++23 template and sample tests', async () => {
    const res = await fetch(`${baseUrl}/api/workspace/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem_id: testProblemId })
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert(json.workspace_path);
    assert(Array.isArray(json.files_created));
    assert(json.files_created.includes('solution.cpp'));

    // Check files actually exist on disk
    assert(fs.existsSync(path.join(json.workspace_path, 'solution.cpp')));
  });

  it('case 2: should reject workspace setup when problem_id is missing with HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/api/workspace/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(res.status, 400);
  });

  it('case 3: should compile scaffolded solution.cpp with C++23 and return compilation result', async () => {
    // Write valid C++23 code that solves the sample test
    const wsDir = path.join('/home/atrv/Desktop/atcoder/workspace', testProblemId);
    fs.mkdirSync(wsDir, { recursive: true });
    const solPath = path.join(wsDir, 'solution.cpp');
    fs.writeFileSync(solPath, `#include <iostream>
int main() {
    int n, k;
    if (std::cin >> n >> k) {
        if (n == 2 && k == 1) std::cout << "499122178\\n";
        else std::cout << "499122179\\n";
    }
    return 0;
}
`, 'utf-8');

    const res = await fetch(`${baseUrl}/api/workspace/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem_id: testProblemId })
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.compiled, true);
    assert(Array.isArray(json.results));
    assert(json.results.length >= 1);
    assert.equal(json.results[0].passed, true);
  });

  it('case 4: should return compilation failure when solution.cpp has syntax errors', async () => {
    const wsDir = path.join('/home/atrv/Desktop/atcoder/workspace', testProblemId);
    const solPath = path.join(wsDir, 'solution.cpp');
    fs.writeFileSync(solPath, `invalid_cpp_syntax_error();`, 'utf-8');

    const res = await fetch(`${baseUrl}/api/workspace/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem_id: testProblemId })
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.compiled, false);
  });

  it('case 5: should reject workspace run when problem_id is missing with HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/api/workspace/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(res.status, 400);
  });
});
