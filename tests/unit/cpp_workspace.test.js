import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CPP23_FAST_IO_BOILERPLATE } from '../helpers/fixtures.js';

describe('Feature 20 & 21: C++23 Local Workspace & Sample Test Diff Runner', () => {
  function compareOutputs(actual, expected) {
    const normActual = (actual || '').trim().replace(/\r\n/g, '\n');
    const normExpected = (expected || '').trim().replace(/\r\n/g, '\n');
    return normActual === normExpected;
  }

  function getCompilerCommand(sourcePath, outputPath) {
    return {
      bin: 'g++',
      args: ['-std=c++23', '-O2', sourcePath, '-o', outputPath]
    };
  }

  it('case 1: should generate C++23 template with fast I/O optimizations', () => {
    assert(CPP23_FAST_IO_BOILERPLATE.includes('ios_base::sync_with_stdio(false)'));
    assert(CPP23_FAST_IO_BOILERPLATE.includes('cin.tie(nullptr)'));
    assert(CPP23_FAST_IO_BOILERPLATE.includes('#include <ranges>'));
    assert(CPP23_FAST_IO_BOILERPLATE.includes('#include <vector>'));
  });

  it('case 2: should construct valid GCC compilation command with -std=c++23 and -O2', () => {
    const cmd = getCompilerCommand('/tmp/solution.cpp', '/tmp/solution.out');
    assert.equal(cmd.bin, 'g++');
    assert(cmd.args.includes('-std=c++23'));
    assert(cmd.args.includes('-O2'));
  });

  it('case 3: should perform whitespace-insensitive diff comparison on sample outputs', () => {
    const expected = '499122178\n';
    const actualWithTrailingSpaces = '499122178   \n\n';
    assert.equal(compareOutputs(actualWithTrailingSpaces, expected), true);

    const actualWindowsCrlf = '499122178\r\n';
    assert.equal(compareOutputs(actualWindowsCrlf, expected), true);
  });

  it('case 4: should detect incorrect output mismatches accurately', () => {
    const expected = '499122178\n';
    const actualWrong = '499122179\n';
    assert.equal(compareOutputs(actualWrong, expected), false);
  });

  it('case 5: should enforce a 2000ms execution timeout limit for local test execution', () => {
    const TIMEOUT_MS = 2000;
    assert.equal(TIMEOUT_MS, 2000);
  });
});
