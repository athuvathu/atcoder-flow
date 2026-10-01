// Competitive Companion / CPH Local Dispatcher
// Dispatches problem statements and test cases directly to local editor ports (10043, 10045, 4244, 27121)

const CPH_PORTS = [10043, 10045, 4244, 27121];
const CPH_TIMEOUT_MS = 1500;

/**
 * Sends problem data directly to a local Competitive Companion listener.
 * 
 * @param {object} problem 
 * @param {Array<{input: string, output: string}>} samples
 * @returns {Promise<{ delivered: boolean, port?: number, error?: string }>}
 */
export async function pushToLocalCPH(problem, samples = []) {
  if (!problem || !problem.id) {
    return { delivered: false, error: 'Invalid problem data' };
  }

  const contest = (problem.contest_id || '').toUpperCase();
  const title = problem.title || problem.name || problem.id;
  const url = problem.url || `https://atcoder.jp/contests/${problem.contest_id}/tasks/${problem.id}`;

  const payload = {
    name: title,
    group: `AtCoder - ${contest}`,
    url: url,
    interactive: false,
    memoryLimit: problem.memory_limit_mb || 1024,
    timeLimit: problem.time_limit_ms || 2000,
    tests: samples.map(s => ({
      input: s.input.endsWith('\n') ? s.input : `${s.input}\n`,
      output: s.output.endsWith('\n') ? s.output : `${s.output}\n`
    })),
    testType: 'single',
    input: { type: 'stdin' },
    output: { type: 'stdout' },
    languages: {
      java: { mainClass: 'Main', taskClass: problem.id.replace(/[^a-zA-Z0-9]/g, '') }
    }
  };

  // Try each standard CPH port sequentially
  for (const port of CPH_PORTS) {
    const targetUrl = `http://127.0.0.1:${port}/`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CPH_TIMEOUT_MS);

    try {
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (res.ok || res.status === 200 || res.status === 204) {
        return { delivered: true, port };
      }
    } catch (_) {
      clearTimeout(timer);
      // Port not listening, continue to next
    }
  }

  return {
    delivered: false,
    error: 'No active CPH listener detected on ports 10043, 10045, 4244, or 27121. Is VS Code / Neovim with CPH open?'
  };
}
