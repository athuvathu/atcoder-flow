import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isValidProblemId,
  normalizeOutput,
  compareOutputs,
  setupWorkspace,
  runWorkspaceTests
} from '../../server/workspace.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const WORKSPACE_DIR = path.join(PROJECT_ROOT, 'workspace');

describe('Adversarial Stress Test: C++23 Workspace Sandbox & Subprocess Execution', () => {
  const testWorkspaceDirs = [];

  const cleanupDir = (dirName) => {
    const fullPath = path.join(WORKSPACE_DIR, dirName);
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    }
  };

  after(() => {
    for (const d of testWorkspaceDirs) {
      cleanupDir(d);
    }
  });

  test('1. Path Traversal & Shell Injection rejection in problem_id validation', async () => {
    const maliciousProblemIds = [
      '../../etc/passwd',
      '..\\..\\windows\\system32',
      '/etc/shadow',
      'abc360_e/../../secret',
      'abc; rm -rf /',
      'abc`id`',
      'abc$(whoami)',
      'abc|ls',
      'abc\0injection',
      '',
      '   ',
      null,
      undefined,
      12345,
      {},
      []
    ];

    for (const pid of maliciousProblemIds) {
      assert.equal(
        isValidProblemId(pid),
        false,
        `Problem ID '${pid}' must be rejected by isValidProblemId`
      );

      if (typeof pid === 'string' && pid.trim().length > 0) {
        await assert.rejects(
          async () => setupWorkspace(pid),
          /Invalid problem ID/,
          `setupWorkspace must reject traversal ID '${pid}'`
        );

        await assert.rejects(
          async () => runWorkspaceTests(pid),
          /Invalid problem ID/,
          `runWorkspaceTests must reject traversal ID '${pid}'`
        );
      }
    }
  });

  test('2. Modern C++23 features compilation with GCC 16.2.1 (-std=c++23 -O2)', async () => {
    const problemId = 'stress_cpp23_modern';
    testWorkspaceDirs.push(problemId);
    cleanupDir(problemId);

    const wsDir = path.join(WORKSPACE_DIR, problemId);
    fs.mkdirSync(wsDir, { recursive: true });

    // Modern C++23 code: ranges pipeline, concepts constraint, views::iota, fold_left
    const modernCppCode = `#include <iostream>
#include <vector>
#include <ranges>
#include <concepts>
#include <algorithm>
#include <numeric>

template<typename T>
concept Number = std::integral<T> || std::floating_point<T>;

template<Number T>
T multiply(T a, T b) {
    return a * b;
}

int main() {
    // C++23 ranges views pipeline
    auto squares = std::views::iota(1, 6)
                 | std::views::filter([](int x) { return x % 2 != 0; })
                 | std::views::transform([](int x) { return multiply(x, x); });

    int total = 0;
    for (int v : squares) {
        total += v; // 1^2 + 3^2 + 5^2 = 1 + 9 + 25 = 35
    }

    std::cout << total << "\\n";
    return 0;
}
`;

    fs.writeFileSync(path.join(wsDir, 'solution.cpp'), modernCppCode, 'utf-8');
    fs.writeFileSync(path.join(wsDir, 'sample_1.in'), '', 'utf-8');
    fs.writeFileSync(path.join(wsDir, 'sample_1.out'), '35\n', 'utf-8');

    const result = await runWorkspaceTests(problemId);

    assert.equal(result.compiled, true, `Modern C++23 compilation must succeed. Compiler error: ${result.compiler_error}`);
    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].passed, true, `Result should pass (expected: 35, got: ${result.results[0].actual})`);
    assert.equal(result.results[0].actual, '35');
  });

  test('3. Infinite loop execution strictly terminated by 2000ms SIGKILL', async () => {
    const problemId = 'stress_infinite_loop';
    testWorkspaceDirs.push(problemId);
    cleanupDir(problemId);

    const wsDir = path.join(WORKSPACE_DIR, problemId);
    fs.mkdirSync(wsDir, { recursive: true });

    // C++ code with deliberate infinite loop
    const infiniteLoopCode = `#include <iostream>
int main() {
    volatile unsigned long long counter = 0;
    while (true) {
        counter++;
    }
    std::cout << counter << "\\n";
    return 0;
}
`;

    fs.writeFileSync(path.join(wsDir, 'solution.cpp'), infiniteLoopCode, 'utf-8');
    fs.writeFileSync(path.join(wsDir, 'sample_1.in'), '', 'utf-8');
    fs.writeFileSync(path.join(wsDir, 'sample_1.out'), '0\n', 'utf-8');

    const startT = Date.now();
    const result = await runWorkspaceTests(problemId);
    const duration = Date.now() - startT;

    console.log(`    [Timeout Stress] Infinite loop killed after ${duration}ms (recorded test time: ${result.results[0]?.time_ms}ms)`);

    assert.equal(result.compiled, true, 'Compilation should succeed');
    assert.equal(result.results.length, 1);
    const testCase = result.results[0];

    assert.equal(testCase.passed, false, 'Infinite loop must fail test case');
    assert.equal(testCase.timed_out, true, 'timed_out flag must be true');
    // Subprocess execution must terminate within reasonable bound around 2000ms
    assert.ok(duration >= 1950 && duration <= 2800, `Execution should terminate close to 2000ms timeout (took ${duration}ms)`);
  });

  test('4. Memory hog / abnormal crash (SIGSEGV / bad_alloc) handled without crashing host', async () => {
    const problemId = 'stress_crash_sigsegv';
    testWorkspaceDirs.push(problemId);
    cleanupDir(problemId);

    const wsDir = path.join(WORKSPACE_DIR, problemId);
    fs.mkdirSync(wsDir, { recursive: true });

    // C++ code that deliberately dereferences nullptr (SIGSEGV)
    const crashCode = `#include <iostream>
#include <vector>

int main() {
    // Attempt huge vector or null pointer dereference
    volatile int* ptr = nullptr;
    *ptr = 1337;
    std::cout << *ptr << "\\n";
    return 0;
}
`;

    fs.writeFileSync(path.join(wsDir, 'solution.cpp'), crashCode, 'utf-8');
    fs.writeFileSync(path.join(wsDir, 'sample_1.in'), '', 'utf-8');
    fs.writeFileSync(path.join(wsDir, 'sample_1.out'), '1337\n', 'utf-8');

    const result = await runWorkspaceTests(problemId);

    assert.equal(result.compiled, true, 'Compilation should succeed');
    assert.equal(result.results.length, 1);
    const testCase = result.results[0];

    assert.equal(testCase.passed, false, 'Crashing program must not pass');
    // Exit code should indicate abnormal termination (non-zero or null when killed by signal)
    assert.notEqual(testCase.exit_code, 0, 'Exit code must be non-zero for crashing process');
    assert.equal(testCase.timed_out, false, 'Crashing process should terminate immediately, not timeout');
  });

  test('5. Whitespace and floating-point diff comparator invariance', () => {
    // Case A: Windows CRLF vs Unix LF
    const crlf = "1 2 3\r\n4 5 6\r\n7 8 9\r\n";
    const lf = "1 2 3\n4 5 6\n7 8 9\n";
    assert.equal(compareOutputs(crlf, lf), true, 'CRLF vs LF must evaluate as equal');

    // Case B: Trailing spaces on lines
    const trailingSpaces = "line 1   \nline 2 \t \nline 3\n";
    const cleanLines = "line 1\nline 2 \t\nline 3\n";
    assert.equal(compareOutputs(trailingSpaces, cleanLines), true, 'Trailing spaces on lines must be ignored');

    // Case C: Excessive trailing newlines
    const trailingNewlines = "answer\n\n\n\n";
    const singleNewline = "answer\n";
    assert.equal(compareOutputs(trailingNewlines, singleNewline), true, 'Excessive trailing newlines must be normalized');

    // Case D: Single scalar float within 1e-6 tolerance
    assert.equal(compareOutputs("3.14159265", "3.14159260"), true, 'Float within 1e-6 must match');
    assert.equal(compareOutputs("3.14150000", "3.14170000"), false, 'Float outside 1e-6 must fail');

    // Case E: Multi-line floating point numbers within tolerance
    const floatActual = "1.0000001\n2.0000002\n";
    const floatExpected = "1.0000005\n2.0000004\n";
    assert.equal(compareOutputs(floatActual, floatExpected), true, 'Multi-line floats within 1e-6 must match');

    // Case F: Content difference must fail
    assert.equal(compareOutputs("42", "43"), false, 'Distinct outputs must fail');
    assert.equal(compareOutputs("Yes", "No"), false, 'Yes vs No must fail');
  });
});
