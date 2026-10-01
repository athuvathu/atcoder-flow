// Official AtCoder Problem Statement & Sample Scraper
// Scrapes real task statements, constraints, limits, and sample test cases.

const USER_AGENT = 'AtCoderFlowClient/1.0 (local practice client; https://github.com/atrv/atcoder-flow)';
const REQUEST_TIMEOUT_MS = 7000;

/**
 * Scrapes an official AtCoder problem page for task statement, time/memory limits,
 * and authentic sample test inputs/outputs.
 * 
 * @param {string} contestId e.g. "abc183"
 * @param {string} problemId e.g. "abc183_e"
 * @returns {Promise<{
 *   problem_id: string,
 *   time_limit_ms: number,
 *   memory_limit_mb: number,
 *   statement_html: string,
 *   samples: Array<{ input: string, output: string }>
 * }>}
 */
export async function scrapeProblemDetails(contestId, problemId) {
  if (!contestId || !problemId) {
    throw new Error(`Invalid contestId ('${contestId}') or problemId ('${problemId}')`);
  }

  const cleanContest = contestId.toLowerCase().trim();
  const cleanProblem = problemId.toLowerCase().trim();
  const taskUrl = `https://atcoder.jp/contests/${cleanContest}/tasks/${cleanProblem}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(taskUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`AtCoder HTTP ${res.status}: ${res.statusText}`);
    }

    const html = await res.text();

    // 1. Time Limit & Memory Limit
    const limitMatch = html.match(/Time Limit:\s*([\d.]+)\s*sec\s*\/\s*Memory Limit:\s*(\d+)\s*M[iI]?B/i);
    const timeLimitMs = limitMatch ? Math.round(parseFloat(limitMatch[1]) * 1000) : 2000;
    const memoryLimitMb = limitMatch ? parseInt(limitMatch[2], 10) : 1024;

    // 2. English Task Statement Section
    let enSection = '';
    const enMatch = html.match(/<span class="lang-en">([\s\S]*?)<\/span>/i);
    if (enMatch) {
      enSection = enMatch[1];
    } else {
      const taskMatch = html.match(/<div id="task-statement">([\s\S]*?)<\/div>\s*<\/div>/i);
      enSection = taskMatch ? taskMatch[1] : '';
    }

    // Fix relative links & images to official AtCoder CDN
    enSection = enSection
      .replace(/src="\/(img\/[^"]+)"/g, 'src="https://atcoder.jp/$1"')
      .replace(/href="\/(contests\/[^"]+)"/g, 'href="https://atcoder.jp/$1" target="_blank"');

    // 3. Extract Real Sample Test Cases
    const samples = [];
    const inRegex = /<h3>\s*Sample Input\s*(\d+)\s*<\/h3>\s*<pre>([\s\S]*?)<\/pre>/gi;
    let match;
    while ((match = inRegex.exec(enSection)) !== null) {
      const idx = match[1];
      const rawInput = match[2];
      const outRegex = new RegExp(`<h3>\\s*Sample Output\\s*${idx}\\s*</h3>\\s*<pre>([\\s\\S]*?)</pre>`, 'i');
      const outMatch = enSection.match(outRegex);
      if (outMatch) {
        samples.push({
          input: rawInput.replace(/\r\n/g, '\n'),
          output: outMatch[1].replace(/\r\n/g, '\n')
        });
      }
    }

    return {
      problem_id: cleanProblem,
      time_limit_ms: timeLimitMs,
      memory_limit_mb: memoryLimitMb,
      statement_html: enSection.trim(),
      samples
    };
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}
