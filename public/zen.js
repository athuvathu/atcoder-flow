// Zen Flow Mode & Compulsion Loop HUD for AtCoder Practice Platform
// Terminal-grade minimal unixporn styling, Par race, 350ms digital reel roll,
// non-blocking AC verification, and pauseable persistent stopwatch.

import { audioEngine } from './audio.js';
import { atcoderToCodeforces, getAtcoderMeta } from './rating.js';

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class ZenFlowHUD {
  constructor(containerEl, options = {}) {
    this.container = containerEl;
    this.options = options;
    this.currentProblem = null;
    this.revealedCategory = false;

    // Session stopwatch & state
    this.elapsedSeconds = 0;
    this.isPaused = false;
    this.timerInterval = null;
    this.sessionSolves = 0;
    this.trainingRating = 1200;
    this.streak = 0;
    this.primedProblem = null;
    this.activeMode = options.mode || 'flow';
    this.isReaderOpen = false;
    this.isNotesOpen = false;
    this.statementData = null;
    this.gauntletState = {
      active: false,
      stage: 1,
      solves: []
    };

    // Callbacks
    this.onExit = options.onExit || (() => {});
    this.onSolveAC = options.onSolveAC || (() => {});

    this.restoreSession();
  }

  /**
   * Restores session state from localStorage if available.
   */
  restoreSession() {
    try {
      const saved = localStorage.getItem('atcoder_flow_zen_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.problem_id && parsed.saved_epoch) {
          const age = Math.floor(Date.now() / 1000) - parsed.saved_epoch;
          if (age < 86400) { // Valid within 24h
            this.elapsedSeconds = parsed.elapsed_seconds || 0;
            this.isPaused = parsed.is_paused || false;
            this.sessionSolves = parsed.session_solves || 0;
          }
        }
      }
    } catch (_) {}
  }

  /**
   * Persists session state to localStorage and backend.
   */
  persistSession() {
    if (!this.currentProblem) return;
    try {
      const stateObj = {
        problem_id: this.currentProblem.id,
        elapsed_seconds: this.elapsedSeconds,
        is_paused: this.isPaused,
        session_solves: this.sessionSolves,
        saved_epoch: Math.floor(Date.now() / 1000)
      };
      localStorage.setItem('atcoder_flow_zen_state', JSON.stringify(stateObj));

      // Asynchronous heartbeat to backend
      fetch('/api/session/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          active_problem_id: this.currentProblem.id,
          session_elapsed_seconds: this.elapsedSeconds,
          session_paused: this.isPaused ? 1 : 0,
          session_solves: this.sessionSolves
        })
      }).catch(() => {});
    } catch (_) {}
  }

  /**
   * Initializes Zen Mode with a selected problem, runs the 350ms reel roll.
   */
  async loadProblem(problem, skipReel = false) {
    this.currentProblem = problem;
    this.revealedCategory = false;
    this.primedProblem = null;
    this.isReaderOpen = false;
    this.isNotesOpen = false;
    this.statementData = null;

    // Asynchronously pre-fetch statement in background for instant reader opening
    fetch(`/api/problems/${problem.id}/statement`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.statement_html) this.statementData = d; })
      .catch(() => {});

    // Fetch full problem details if needed
    if (!problem.url) {
      try {
        const res = await fetch(`/api/problems/${problem.id}`);
        if (res.ok) {
          this.currentProblem = await res.json();
        }
      } catch (_) {}
    }

    // Calibrate Par time
    const diff = this.currentProblem.clipped_difficulty || 1200;
    this.parSeconds = Math.min(2100, Math.max(480, Math.round(600 + (diff - 1000) * 1.5)));

    // Fetch user live training rating and streak
    try {
      const userRes = await fetch('/api/user/state');
      if (userRes.ok) {
        const user = await userRes.json();
        this.trainingRating = user.training_rating || 1200;
        this.streak = user.streak || 0;
      }
    } catch (_) {}

    // Reset stopwatch if opening a new problem
    const saved = localStorage.getItem('atcoder_flow_zen_state');
    const parsed = saved ? JSON.parse(saved) : null;
    if (parsed && parsed.problem_id === problem.id) {
      this.elapsedSeconds = parsed.elapsed_seconds || 0;
      this.isPaused = parsed.is_paused || false;
    } else {
      this.elapsedSeconds = 0;
      this.isPaused = false;
    }

    this.render();

    // Auto-dispatch problem + test cases to local editor / CPH quietly in background
    this.pushToCPH(true);

    if (!skipReel) {
      this.playSlotReelAnimation();
    } else {
      this.startTimer();
    }

    this.persistSession();
  }

  /**
   * 350ms digital slot machine reel roll on problem load.
   */
  playSlotReelAnimation() {
    const titleEl = this.container.querySelector('#zen-slot-title');
    const diffEl = this.container.querySelector('#zen-slot-diff');
    if (!titleEl || !diffEl) {
      this.startTimer();
      return;
    }

    const targetTitle = this.currentProblem.title || this.currentProblem.id;
    const targetDiff = this.currentProblem.clipped_difficulty || 1200;

    const dummyContests = ['ABC180', 'ARC112', 'ABC240', 'ARC140', 'ABC320', 'ABC360', 'AGC045'];
    let ticks = 0;
    const maxTicks = 8;

    const reelInterval = setInterval(() => {
      ticks++;
      audioEngine.playReelTick();

      const randomContest = dummyContests[Math.floor(Math.random() * dummyContests.length)];
      const randomDiff = Math.floor(800 + Math.random() * 800);

      titleEl.textContent = `[ ${randomContest} // Problem Spinning... ]`;
      diffEl.textContent = `DIFF: ${randomDiff}`;
      diffEl.style.color = '#7d8590';

      if (ticks >= maxTicks) {
        clearInterval(reelInterval);
        audioEngine.playClick();
        titleEl.textContent = targetTitle;
        diffEl.textContent = `DIFF: ${targetDiff}`;
        diffEl.style.color = 'var(--accent-cyan)';
        this.startTimer();
      }
    }, 45);
  }

  /**
   * Starts the 1-second cadence stopwatch.
   */
  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      if (!this.isPaused) {
        this.elapsedSeconds++;
        this.updateStopwatchDisplay();

        if (this.elapsedSeconds % 10 === 0) {
          this.persistSession();
        }
      }
    }, 1000);
  }

  destroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Formats seconds into MM:SS.
   */
  formatTime(totalSecs) {
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /**
   * Updates clock and par pacing metrics.
   */
  updateStopwatchDisplay() {
    const clockEl = this.container.querySelector('#zen-clock');
    const paceEl = this.container.querySelector('#zen-par-badge');
    const pacerFill = this.container.querySelector('#ghost-pacer-fill');
    if (!clockEl) return;

    clockEl.textContent = this.formatTime(this.elapsedSeconds);

    const par = Math.max(1, this.parSeconds);
    const ratio = this.elapsedSeconds / par;
    const delta = this.parSeconds - this.elapsedSeconds;

    if (pacerFill) {
      pacerFill.style.width = `${Math.min(100, ratio * 100)}%`;
      if (ratio <= 0.6) {
        pacerFill.className = 'ghost-pacer-fill pacer-fast';
      } else if (ratio <= 1.0) {
        pacerFill.className = 'ghost-pacer-fill pacer-onpar';
      } else {
        pacerFill.className = 'ghost-pacer-fill pacer-over';
      }
    }

    if (paceEl) {
      if (delta >= 0) {
        paceEl.textContent = `+${this.formatTime(delta)} AHEAD`;
        paceEl.className = 'par-badge par-ahead';
      } else {
        paceEl.textContent = `-${this.formatTime(-delta)} OVER PAR`;
        paceEl.className = 'par-badge par-behind';
      }
    }
  }

  /**
   * Toggles pause / resume state.
   */
  togglePause() {
    this.isPaused = !this.isPaused;
    audioEngine.playClick();

    const pauseOverlay = this.container.querySelector('#zen-pause-overlay');
    const pauseBtn = this.container.querySelector('#btn-zen-pause');
    const statusTag = this.container.querySelector('#zen-status-indicator');

    if (this.isPaused) {
      if (pauseOverlay) pauseOverlay.style.display = 'flex';
      if (pauseBtn) pauseBtn.textContent = '[Space] RESUME';
      if (statusTag) {
        statusTag.textContent = '[ PAUSED ]';
        statusTag.className = 'status-tag status-paused';
      }
    } else {
      if (pauseOverlay) pauseOverlay.style.display = 'none';
      if (pauseBtn) pauseBtn.textContent = '[Space] PAUSE';
      if (statusTag) {
        statusTag.textContent = '[ RUNNING ]';
        statusTag.className = 'status-tag status-running';
      }
    }

    this.persistSession();
  }

  /**
   * Unmasks the category tag (anti-spoiler nudge).
   */
  revealCategory() {
    this.revealedCategory = true;
    audioEngine.playClick();
    const tagEl = this.container.querySelector('#zen-topic-tag');
    if (tagEl) {
      tagEl.textContent = `Topic: ${this.currentProblem.category || 'General Algorithms'}`;
      tagEl.style.color = 'var(--text-primary)';
      tagEl.style.borderColor = 'var(--border-focus)';
    }
  }

  /**
   * Opens official AtCoder problem page in a new browser tab for CPH grab.
   */
  openOfficialTask() {
    audioEngine.playClick();
    const url = this.currentProblem.url || `https://atcoder.jp/contests/${this.currentProblem.contest_id}/tasks/${this.currentProblem.id}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  /**
   * Opens official editorial in a new tab.
   */
  openEditorial() {
    audioEngine.playClick();
    const url = this.currentProblem.editorial_url || `https://atcoder.jp/contests/${this.currentProblem.contest_id}/editorial`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  /**
   * Pushes the problem and real sample cases directly to a local CPH/Competitive Companion listener.
   */
  async pushToCPH(silent = false) {
    if (!silent) audioEngine.playClick();
    const btn = this.container.querySelector('#btn-zen-cph-push');
    if (btn && !silent) btn.textContent = 'PUSHING...';

    try {
      const res = await fetch('/api/cph/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem_id: this.currentProblem.id })
      });
      const data = await res.json();
      if (data.delivered) {
        if (!silent && typeof audioEngine.playChime === 'function') audioEngine.playChime();
        this.showToast(`Pushed to CPH / Editor (port ${data.port})! Problem ready.`, 'info');
      } else if (!silent) {
        this.showToast(data.error || 'CPH listener not active. Press [o] to open AtCoder task in browser.', 'info');
      }
    } catch (err) {
      if (!silent) {
        this.showToast(`CPH push error: ${err.message}. Opening in browser...`, 'info');
        this.openOfficialTask();
      }
    } finally {
      if (btn && !silent) btn.textContent = '[c] CPH PUSH';
    }
  }

  /**
   * Toggles the in-app Problem Statement Reader drawer.
   */
  async toggleReader() {
    audioEngine.playClick();
    const drawer = this.container.querySelector('#zen-reader-drawer');
    if (!drawer) return;

    this.isReaderOpen = !this.isReaderOpen;
    drawer.style.display = this.isReaderOpen ? 'flex' : 'none';

    if (this.isReaderOpen) {
      if (this.isNotesOpen) this.toggleNotes();

      if (this.statementData) {
        this.renderReaderContent(drawer, this.statementData);
      } else {
        drawer.innerHTML = `
          <div class="drawer-header">
            <span>TASK STATEMENT & REAL SAMPLES</span>
            <button id="btn-close-reader" class="btn-drawer-close">[r] CLOSE</button>
          </div>
          <div class="drawer-loading">Fetching official statement from AtCoder...</div>
        `;
        drawer.querySelector('#btn-close-reader').addEventListener('click', () => this.toggleReader());

        try {
          const res = await fetch(`/api/problems/${this.currentProblem.id}/statement`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to load statement');
          this.statementData = data;
          this.renderReaderContent(drawer, data);
        } catch (err) {
          drawer.innerHTML = `
            <div class="drawer-header">
              <span>TASK STATEMENT</span>
              <button id="btn-close-reader" class="btn-drawer-close">[r] CLOSE</button>
            </div>
            <div class="drawer-error">
              Could not fetch statement: ${escapeHtml(err.message)}
              <div style="margin-top:12px;">
                <button id="btn-fallback-open" class="btn-primary">[o] ATCODER TASK</button>
              </div>
            </div>
          `;
          drawer.querySelector('#btn-close-reader').addEventListener('click', () => this.toggleReader());
          drawer.querySelector('#btn-fallback-open')?.addEventListener('click', () => this.openOfficialTask());
        }
      }
    }
  }

  /**
   * Renders parsed problem statement and interactive sample copy boxes into reader drawer.
   */
  renderReaderContent(drawer, data) {
    const timeLimitSec = data.time_limit_ms ? (data.time_limit_ms / 1000).toFixed(1) : '2.0';
    const memLimitMb = data.memory_limit_mb || 1024;
    const samples = data.samples || [];

    drawer.innerHTML = `
      <div class="drawer-header">
        <div class="drawer-title-group">
          <strong>${this.currentProblem.title || this.currentProblem.id}</strong>
          <span class="limit-pill">LIMIT: ${timeLimitSec}s · ${memLimitMb}MB</span>
        </div>
        <button id="btn-close-reader" class="btn-drawer-close">[r] CLOSE</button>
      </div>

      <div class="drawer-scroll-body">
        <div class="statement-html-content">
          ${data.statement_html || '<p>No English statement available.</p>'}
        </div>

        ${samples.length > 0 ? `
          <div class="samples-section">
            <h3 class="samples-heading">OFFICIAL SAMPLES [${samples.length}]</h3>
            ${samples.map((s, idx) => `
              <div class="sample-box">
                <div class="sample-header">
                  <span>SAMPLE ${idx + 1}</span>
                  <div class="sample-copy-btns">
                    <button class="btn-copy-sample" data-copy="in-${idx}">COPY IN</button>
                    <button class="btn-copy-sample" data-copy="out-${idx}">COPY OUT</button>
                  </div>
                </div>
                <div class="sample-grid">
                  <div class="sample-col">
                    <span class="col-lbl">INPUT</span>
                    <pre id="sample-in-${idx}">${escapeHtml(s.input)}</pre>
                  </div>
                  <div class="sample-col">
                    <span class="col-lbl">OUTPUT</span>
                    <pre id="sample-out-${idx}">${escapeHtml(s.output)}</pre>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;

    // Render LaTeX math formulas across statement
    const statementEl = drawer.querySelector('.statement-html-content');
    if (statementEl) {
      this.renderLatex(statementEl);
    }

    drawer.querySelector('#btn-close-reader').addEventListener('click', () => this.toggleReader());

    drawer.querySelectorAll('.btn-copy-sample').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.target.dataset.copy;
        const pre = drawer.querySelector(`#sample-${target}`);
        if (pre) {
          navigator.clipboard.writeText(pre.textContent).then(() => {
            const originalText = e.target.textContent;
            e.target.textContent = 'COPIED';
            audioEngine.playClick();
            setTimeout(() => e.target.textContent = originalText, 1500);
          }).catch(() => {
            this.showToast('Could not access clipboard', 'info');
          });
        }
      });
    });
  }

  /**
   * Renders LaTeX math formulas inside element using KaTeX.
   * Handles AtCoder's <var>...</var> tags and standard TeX delimiters.
   */
  renderLatex(element) {
    if (!element) return;

    // 1. Process all <var> tags (AtCoder wraps LaTeX math in <var>)
    const varElements = element.querySelectorAll('var');
    varElements.forEach(varEl => {
      const tex = varEl.textContent ? varEl.textContent.trim() : '';
      if (!tex) return;
      try {
        if (window.katex && typeof window.katex.render === 'function') {
          window.katex.render(tex, varEl, {
            throwOnError: false,
            displayMode: false
          });
        }
      } catch (err) {
        // Fallback: keep text content as is
      }
    });

    // 2. Process standard math delimiters in the rest of the text
    if (window.renderMathInElement && typeof window.renderMathInElement === 'function') {
      try {
        window.renderMathInElement(element, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '\\[', right: '\\]', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false }
          ],
          throwOnError: false,
          ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
        });
      } catch (err) {
        // Suppress delimiter parsing errors
      }
    }
  }

  /**
   * Toggles the inline Scratchpad / Invariants drawer.
   */
  toggleNotes() {
    audioEngine.playClick();
    const drawer = this.container.querySelector('#zen-notes-drawer');
    if (!drawer) return;

    this.isNotesOpen = !this.isNotesOpen;
    drawer.style.display = this.isNotesOpen ? 'flex' : 'none';

    if (this.isNotesOpen) {
      if (this.isReaderOpen) this.toggleReader();

      const storageKey = `atcoder_notes_${this.currentProblem.id}`;
      const savedNotes = localStorage.getItem(storageKey) || '';
      drawer.innerHTML = `
        <div class="drawer-header">
          <span>SCRATCHPAD & INVARIANTS</span>
          <button id="btn-close-notes" class="btn-drawer-close">✕ [n / Esc]</button>
        </div>
        <div class="notes-body">
          <textarea id="zen-scratchpad-input" placeholder="Jot invariants, state space, complexity bounds, or counter-examples here...">${escapeHtml(savedNotes)}</textarea>
          <div class="notes-footer">Auto-saved to local storage for ${this.currentProblem.id}</div>
        </div>
      `;
      drawer.querySelector('#btn-close-notes').addEventListener('click', () => this.toggleNotes());
      const textarea = drawer.querySelector('#zen-scratchpad-input');
      textarea.focus();
      textarea.addEventListener('input', (e) => {
        localStorage.setItem(storageKey, e.target.value);
      });
    }
  }

  /**
   * Sets practice intensity mode and fetches next problem in that bracket.
   */
  async setPracticeMode(mode) {
    if (this.activeMode === mode) return;
    this.activeMode = mode;
    audioEngine.playClick();
    this.showToast(`Switched mode to ${mode.toUpperCase()}. Fetching next problem...`, 'info');
    try {
      const res = await fetch(`/api/flow/next?mode=${mode}`);
      const prob = await res.json();
      if (res.ok && prob && prob.id) {
        this.loadProblem(prob);
      }
    } catch (_) {}
  }

  /**
   * Handles problem solve with instant AC check and optimistic attestation.
   */
  async handleSolve(optimistic = false) {
    const solveBtn = this.container.querySelector('#btn-zen-verify');
    if (solveBtn) {
      solveBtn.disabled = true;
      solveBtn.textContent = 'VERIFYING...';
    }

    try {
      const res = await fetch('/api/compulsion/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem_id: this.currentProblem.id,
          elapsed_seconds: this.elapsedSeconds,
          optimistic: Boolean(optimistic)
        })
      });

      const data = await res.json();

      // Case 1: Already solved
      if (res.status === 409 && data.already_solved) {
        this.showToast('Problem already recorded as solved.', 'info');
        if (solveBtn) {
          solveBtn.disabled = false;
          solveBtn.textContent = '[v] VERIFY AC';
        }
        await this.handleSkip('neutral');
        return;
      }

      // Case 2: Kenkoooo API lag detected — allow immediate 1-key attestation
      if (!optimistic && data.lag_possible) {
        if (solveBtn) {
          solveBtn.disabled = false;
          solveBtn.textContent = '[Enter] ATTEST AC';
          solveBtn.classList.add('btn-attest-pulse');
        }
        this.showAttestModal();
        return;
      }

      if (!res.ok) {
        this.showToast(`Error: ${data.error || 'Solve verification failed'}`, 'error');
        if (solveBtn) {
          solveBtn.disabled = false;
          solveBtn.textContent = '[v] VERIFY AC';
        }
        return;
      }

      // ===== JACKPOT: Verified or Attested AC =====
      this.sessionSolves++;
      this.trainingRating = data.training_rating;
      this.streak = data.streak;
      this.primedProblem = data.primed_problem;

      // Clear active problem in localStorage
      localStorage.removeItem('atcoder_flow_zen_state');

      // Trigger multi-stage euphoric feedback
      this.showJackpotCelebration(data);

    } catch (err) {
      this.showToast(`Network error: ${err.message}`, 'error');
      if (solveBtn) {
        solveBtn.disabled = false;
        solveBtn.textContent = '[v] VERIFY AC';
      }
    }
  }

  /**
   * Shows inline attestation prompt when Kenkoooo is lagging.
   */
  showAttestModal() {
    const existing = this.container.querySelector('.attest-prompt-bar');
    if (existing) return;

    const bar = document.createElement('div');
    bar.className = 'attest-prompt-bar';
    bar.innerHTML = `
      <span>Kenkoooo sync is lagging (2-5m delay). If you saw Green AC on AtCoder:</span>
      <button id="btn-confirm-attest" class="btn-attest-confirm">[Enter] Attest AC & Continue</button>
    `;
    this.container.querySelector('.zen-action-cluster').prepend(bar);

    bar.querySelector('#btn-confirm-attest').addEventListener('click', () => {
      bar.remove();
      this.handleSolve(true);
    });
  }

  /**
   * Terminal-grade solve verdict card with AtCoder and Codeforces performance metrics.
   */
  showJackpotCelebration(data) {
    try {
      if (typeof audioEngine.playChime === 'function') audioEngine.playChime();
      if (data.is_critical && typeof audioEngine.playJackpot === 'function') {
        audioEngine.playJackpot();
      }
    } catch (_) {}

    const isGauntlet = Boolean(this.gauntletState && this.gauntletState.active);
    if (isGauntlet) {
      this.gauntletState.solves.push({
        stage: this.gauntletState.stage,
        problem: this.currentProblem,
        data: data
      });

      if (this.gauntletState.stage >= 3) {
        this.renderGauntletScorecard();
        return;
      }
    }

    const overlay = document.createElement('div');
    overlay.className = 'zen-jackpot-overlay';

    const beatPar = data.beat_par;
    const parDiffText = beatPar
      ? `BEAT PAR BY ${this.formatTime(data.par_diff_seconds)}`
      : `MISSED PAR BY ${this.formatTime(-data.par_diff_seconds)}`;

    const cfPerf = atcoderToCodeforces(data.solve_performance);
    const cfTr = atcoderToCodeforces(data.training_rating);
    const atTr = getAtcoderMeta(data.training_rating);

    const surgeBannerHtml = data.is_critical 
      ? `<div class="surge-badge critical">[ CRITICAL SPEED SURGE: +${data.speed_surge_bonus} BONUS ]</div>`
      : data.is_clutch 
      ? `<div class="surge-badge clutch">[ CLUTCH AC: PAR WINDOW LOCKED ]</div>`
      : '';

    const gauntletBannerHtml = isGauntlet
      ? `<div class="gauntlet-stage-banner">[ GAUNTLET STAGE ${this.gauntletState.stage}/3 CLEARED! ]</div>`
      : '';

    const nextPromptHtml = isGauntlet
      ? `<div class="next-reel-cue">NEXT GAUNTLET STAGE: <strong>STAGE ${this.gauntletState.stage + 1}/3 (${this.gauntletState.stage === 1 ? 'FLOW' : 'BOSS'})</strong></div>
         <div class="jackpot-action-btns">
           <button id="btn-gauntlet-advance" class="btn-jackpot-launch">[Enter] Advance to Stage ${this.gauntletState.stage + 1}</button>
           <button id="btn-jackpot-exit" class="btn-jackpot-ghost">[Esc] Abort Gauntlet</button>
         </div>`
      : data.primed_problem 
      ? `<div class="next-reel-cue">NEXT PROBLEM: <strong>${data.primed_problem.title || data.primed_problem.id}</strong> (Diff: ${data.primed_problem.clipped_difficulty})</div>
         <div class="jackpot-action-btns">
           <button id="btn-jackpot-next" class="btn-jackpot-launch">[Enter] Next Problem</button>
           <button id="btn-jackpot-exit" class="btn-jackpot-ghost">[Esc] Practice Table</button>
         </div>`
      : `<div class="next-reel-cue">Practice block complete!</div>
         <button id="btn-jackpot-exit" class="btn-jackpot-launch">[Enter] Return to Table</button>`;

    overlay.innerHTML = `
      <div class="jackpot-card">
        <div class="jackpot-verdict">[ ACCEPTED ]</div>
        ${surgeBannerHtml}
        ${gauntletBannerHtml}
        <div class="jackpot-task">${this.currentProblem.title || this.currentProblem.id}</div>

        <div class="jackpot-metrics-row">
          <div class="jackpot-metric">
            <span class="jm-label">SOLVE TIME</span>
            <span class="jm-val">${this.formatTime(data.elapsed_seconds)}</span>
          </div>
          <div class="jackpot-metric">
            <span class="jm-label">PAR PACING</span>
            <span class="jm-val ${beatPar ? 'par-ahead' : 'par-behind'}">${parDiffText}</span>
          </div>
          <div class="jackpot-metric">
            <span class="jm-label">ATCODER PERF</span>
            <span class="jm-val odometer-target" id="odometer-val">${data.solve_performance}</span>
          </div>
          <div class="jackpot-metric">
            <span class="jm-label">CF EQUIVALENT</span>
            <span class="jm-val" style="color:${cfPerf.color};">${cfPerf.cfRating} <small style="font-size:11px; opacity:0.85;">[${cfPerf.title}]</small></span>
          </div>
        </div>

        <div class="jackpot-streak-bar">
          <span>Session Streak:</span>
          <strong>${this.sessionSolves} In-a-Row</strong>
          <span class="sep">·</span>
          <span>Training Rating: <strong style="color:${atTr.color};">${data.training_rating}</strong> (+${data.rating_delta}) <span style="color:${cfTr.color}; margin-left:4px;">[CF ${cfTr.cfRating} ${cfTr.title}]</span></span>
        </div>

        <div class="jackpot-next-prompt">
          ${nextPromptHtml}
        </div>
      </div>
    `;

    this.container.appendChild(overlay);

    // Odometer number roll-up animation
    this.animateOdometer(overlay.querySelector('#odometer-val'), data.solve_performance - 150, data.solve_performance);

    const gauntletAdvBtn = overlay.querySelector('#btn-gauntlet-advance');
    if (gauntletAdvBtn) {
      gauntletAdvBtn.focus();
      gauntletAdvBtn.addEventListener('click', () => {
        overlay.remove();
        this.gauntletState.stage++;
        this.fetchGauntletStage(this.gauntletState.stage);
      });
    }

    const nextBtn = overlay.querySelector('#btn-jackpot-next');
    if (nextBtn) {
      nextBtn.focus();
      nextBtn.addEventListener('click', () => {
        overlay.remove();
        if (data.primed_problem) {
          this.loadProblem(data.primed_problem);
        } else {
          this.destroy();
          this.onExit();
        }
      });
    }

    const exitBtn = overlay.querySelector('#btn-jackpot-exit');
    if (exitBtn) {
      exitBtn.addEventListener('click', () => {
        overlay.remove();
        if (isGauntlet) {
          this.gauntletState = { active: false, stage: 1, solves: [] };
        }
        this.destroy();
        this.onExit();
      });
    }
  }

  /**
   * Initiates a structured 3-problem Gauntlet Run (Warmup -> Flow -> Boss).
   */
  startGauntletRun() {
    this.gauntletState = {
      active: true,
      stage: 1,
      solves: [],
      startTime: Date.now()
    };
    audioEngine.playChime();
    this.showToast('Starting 3-Problem Flow Gauntlet: Stage 1 [Warmup]...', 'info');
    this.fetchGauntletStage(1);
  }

  /**
   * Fetches problem tailored for current gauntlet stage.
   */
  async fetchGauntletStage(stageNum) {
    const modes = { 1: 'warmup', 2: 'flow', 3: 'boss' };
    const mode = modes[stageNum] || 'flow';
    try {
      const res = await fetch(`/api/flow/next?mode=${mode}`);
      if (res.ok) {
        const prob = await res.json();
        this.loadProblem(prob);
      } else {
        this.showToast('Could not load gauntlet stage problem.', 'error');
      }
    } catch (err) {
      this.showToast(`Error fetching gauntlet stage: ${err.message}`, 'error');
    }
  }

  /**
   * Renders the Terminal Run Scorecard upon completing all 3 Gauntlet stages.
   */
  renderGauntletScorecard() {
    try {
      if (typeof audioEngine.playJackpot === 'function') audioEngine.playJackpot();
    } catch (_) {}
    const overlay = document.createElement('div');
    overlay.className = 'zen-jackpot-overlay';

    const solves = this.gauntletState.solves;
    const totalElapsed = solves.reduce((sum, s) => sum + (s.data.elapsed_seconds || 0), 0);
    const totalDelta = solves.reduce((sum, s) => sum + (s.data.rating_delta || 0), 0);
    const avgPerf = solves.length > 0
      ? Math.round(solves.reduce((sum, s) => sum + (s.data.solve_performance || 1200), 0) / solves.length)
      : 1200;
    const avgCf = atcoderToCodeforces(avgPerf);

    overlay.innerHTML = `
      <div class="jackpot-card gauntlet-scorecard-card">
        <div class="scorecard-header">
          <div class="scorecard-title">[ GAUNTLET RUN CLEARED: 3/3 AC ]</div>
          <span class="scorecard-badge">PERFECT RUN</span>
        </div>

        <div class="scorecard-table">
          <div class="scorecard-row head">
            <span>STAGE</span>
            <span>PROBLEM</span>
            <span>TIME</span>
            <span>ATCODER</span>
            <span>CF EQUIVALENT</span>
          </div>
          ${solves.map((s) => {
            const cf = atcoderToCodeforces(s.data.solve_performance);
            const stageLabel = s.stage === 1 ? '1 [WARMUP]' : s.stage === 2 ? '2 [FLOW]' : '3 [BOSS]';
            return `
              <div class="scorecard-row">
                <span class="stage-tag">${stageLabel}</span>
                <span class="prob-title">${escapeHtml(s.problem.title || s.problem.id)}</span>
                <span class="time-val">${this.formatTime(s.data.elapsed_seconds)}</span>
                <span class="at-val">${s.data.solve_performance}</span>
                <span class="cf-val" style="color:${cf.color};">${cf.badge}</span>
              </div>
            `;
          }).join('')}
        </div>

        <div class="scorecard-summary-grid">
          <div class="summary-metric">
            <span class="sm-label">TOTAL RUN TIME</span>
            <span class="sm-val">${this.formatTime(totalElapsed)}</span>
          </div>
          <div class="summary-metric">
            <span class="sm-label">AVERAGE PERF</span>
            <span class="sm-val" style="color:${avgCf.color}">${avgPerf} [${avgCf.title}]</span>
          </div>
          <div class="summary-metric">
            <span class="sm-label">NET TR GAIN</span>
            <span class="sm-val" style="color:var(--accent-green);">+${totalDelta} TR</span>
          </div>
        </div>

        <div class="jackpot-action-btns">
          <button id="btn-gauntlet-bank" class="btn-jackpot-launch">[Enter] Bank Rating & Cash Out</button>
          <button id="btn-gauntlet-ascend" class="btn-jackpot-ghost">[Space] Ascend to Harder Gauntlet</button>
        </div>
      </div>
    `;

    this.container.appendChild(overlay);

    const bankBtn = overlay.querySelector('#btn-gauntlet-bank');
    if (bankBtn) {
      bankBtn.focus();
      bankBtn.addEventListener('click', () => {
        overlay.remove();
        this.gauntletState = { active: false, stage: 1, solves: [] };
        this.destroy();
        this.onExit();
      });
    }

    const ascendBtn = overlay.querySelector('#btn-gauntlet-ascend');
    if (ascendBtn) {
      ascendBtn.addEventListener('click', () => {
        overlay.remove();
        this.startGauntletRun();
      });
    }
  }

  /**
   * Odometer counter roll-up effect.
   */
  animateOdometer(el, startVal, endVal) {
    if (!el) return;
    const start = Math.max(400, startVal);
    const end = endVal;
    let current = start;
    const step = Math.max(1, Math.round((end - start) / 15));

    const interval = setInterval(() => {
      current += step;
      if (current >= end) {
        current = end;
        clearInterval(interval);
      }
      el.textContent = current;
      audioEngine.playOdometerTick();
    }, 25);
  }

  /**
   * Skips problem with difficulty recalibration.
   */
  async handleSkip(reason = 'neutral') {
    audioEngine.playClick();
    try {
      const res = await fetch('/api/compulsion/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem_id: this.currentProblem.id,
          reason
        })
      });
      const data = await res.json();
      localStorage.removeItem('atcoder_flow_zen_state');

      if (data.primed_problem) {
        this.showToast(`Problem skipped. Difficulty adjusted (${data.delta > 0 ? '+' : ''}${data.delta}). Loading next...`, 'info');
        this.loadProblem(data.primed_problem);
      } else {
        this.destroy();
        this.onExit();
      }
    } catch (_) {
      this.destroy();
      this.onExit();
    }
  }

  /**
   * Shows a minimal toast message.
   */
  showToast(msg, type = 'info') {
    const existing = this.container.querySelector('.zen-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `zen-toast zen-toast-${type}`;
    toast.textContent = msg;
    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }

  /**
   * Renders the clean unixporn Zen interface.
   */
  render() {
    const prob = this.currentProblem || {};
    const contest = (prob.contest_id || '').toUpperCase();
    const problemUrl = prob.url || `https://atcoder.jp/contests/${prob.contest_id}/tasks/${prob.id}`;
    const editorialUrl = prob.editorial_url || `https://atcoder.jp/contests/${prob.contest_id}/editorial`;

    const cfMeta = atcoderToCodeforces(this.trainingRating);
    const atMeta = getAtcoderMeta(this.trainingRating);

    this.container.innerHTML = `
      <div class="zen-wrapper">
        <!-- Ghost Pacer Hairline Track -->
        <div class="ghost-pacer-track" title="Ghost Pacer: Live Par pacing bar">
          <div id="ghost-pacer-fill" class="ghost-pacer-fill"></div>
        </div>

        <!-- Paused Screen Scrim -->
        <div id="zen-pause-overlay" class="zen-pause-scrim" style="display: ${this.isPaused ? 'flex' : 'none'};">
          <div class="pause-card">
            <div class="pause-title">[ PAUSED ]</div>
            <div class="pause-subtitle">Timer and metrics are frozen. Take your time.</div>
            <button id="btn-resume-scrim" class="btn-primary" style="margin-top:16px;">[Space] Resume Practice</button>
          </div>
        </div>

        <!-- Terminal Header HUD -->
        <header class="zen-terminal-hud">
          <div class="hud-left">
            <div class="task-identifier">
              <span id="zen-status-indicator" class="status-tag ${this.isPaused ? 'status-paused' : 'status-running'}">
                [ ${this.isPaused ? 'PAUSED' : 'RUNNING'} ]
              </span>
              ${this.gauntletState && this.gauntletState.active ? `<span class="gauntlet-stage-tag">[ GAUNTLET: STAGE ${this.gauntletState.stage}/3 ]</span>` : ''}
              <span class="contest-slug">${contest}</span>
              <span style="color:var(--text-muted)">//</span>
              <strong id="zen-slot-title" class="task-title">${prob.title || prob.id}</strong>
            </div>
            <div class="task-meta-pills">
              <span id="zen-slot-diff" class="diff-badge">DIFF: ${prob.clipped_difficulty || 'N/A'}</span>
              <span id="zen-topic-tag" class="topic-badge">TOPIC: [HIDDEN // 't']</span>
              <span class="rating-badge">PERF: <strong style="color:${atMeta.color};">${this.trainingRating}</strong> <span style="color:${cfMeta.color}; margin-left:4px;">[CF ${cfMeta.cfRating} ${cfMeta.title}]</span></span>
            </div>
          </div>

          <div class="hud-right">
            <!-- Par Race Stopwatch -->
            <div class="stopwatch-cluster">
              <div id="zen-clock" class="stopwatch-display">${this.formatTime(this.elapsedSeconds)}</div>
              <div class="par-subline">
                <span>Par: ${this.formatTime(this.parSeconds)}</span>
                <span id="zen-par-badge" class="par-badge par-ahead">ON PAR</span>
              </div>
            </div>

            <!-- Session Solves -->
            <div class="session-cluster">
              <div class="streak-label">SESSION: <strong>${this.sessionSolves} AC</strong></div>
              <div class="session-solves-badge">STREAK: <strong>${this.sessionSolves}</strong></div>
            </div>
          </div>
        </header>

        <!-- Training Intensity Mode Selector -->
        <div class="zen-mode-selector">
          <span class="mode-label">INTENSITY:</span>
          <button class="btn-mode ${this.activeMode === 'speed' ? 'active' : ''}" data-mode="speed" title="Fast fluency drills (-200)">[1] Speed</button>
          <button class="btn-mode ${this.activeMode === 'flow' ? 'active' : ''}" data-mode="flow" title="Optimal challenge at Par rating">[2] Flow</button>
          <button class="btn-mode ${this.activeMode === 'reach' ? 'active' : ''}" data-mode="reach" title="Growth breakthrough challenge (+150)">[3] Reach</button>
          <span class="mode-sep">|</span>
          <button id="btn-zen-gauntlet" class="btn-mode-gauntlet ${this.gauntletState && this.gauntletState.active ? 'active' : ''}" title="Launch structured 3-problem Gauntlet Run [g]">[g] Gauntlet Run (3-Stage)</button>
        </div>

        <!-- Command & Direct Action Cluster -->
        <div class="zen-action-cluster">
          <div class="primary-actions">
            <button id="btn-zen-cph-push" class="btn-cph-push" title="Push problem & real samples directly to CPH / Editor [c]">
              [c] CPH PUSH
            </button>
            <button id="btn-zen-reader" class="btn-reader-toggle" title="Read problem statement & copy samples [r]">
              [r] READER
            </button>
            <button id="btn-zen-notes" class="btn-notes-toggle" title="Scratchpad & invariants [n]">
              [n] NOTES
            </button>
            <button id="btn-zen-cph" class="btn-cph-open" title="Open official AtCoder problem page in browser [o]">
              [o] ATCODER
            </button>
            <button id="btn-zen-verify" class="btn-solve-ac" title="Verify submission on AtCoder [v]">
              [v] VERIFY AC
            </button>
            <button id="btn-zen-pause" class="btn-action">
              ${this.isPaused ? '[Space] RESUME' : '[Space] PAUSE'}
            </button>
          </div>

          <div class="secondary-actions">
            <button id="btn-zen-reveal-topic" class="btn-action-ghost" title="Anti-spoiler topic reveal [t]">
              [t] TOPIC
            </button>
            <button id="btn-zen-editorial" class="btn-action-ghost" title="Open official editorial [e]">
              [e] EDITORIAL
            </button>
            <button id="btn-zen-skip" class="btn-action-ghost" title="Skip to next problem [s]">
              [s] SKIP
            </button>
            <button id="btn-zen-back" class="btn-action-ghost" title="Back to Practice Table [Esc]">
              [Esc] TABLE
            </button>
          </div>
        </div>

        <!-- Drawers for Reader and Notes -->
        <div id="zen-reader-drawer" class="zen-drawer" style="display:none;"></div>
        <div id="zen-notes-drawer" class="zen-drawer" style="display:none;"></div>

        <!-- Problem Focus Note Card -->
        <div class="zen-focus-card">
          <div class="focus-card-header">
            <span>QUICK REFERENCE & ERGONOMICS</span>
            <span style="color:var(--text-muted)">Press [c] to push to CPH · Press [r] to read statement · Press [v] when accepted</span>
          </div>
          <div class="focus-card-body">
            <div class="quick-link-row">
              <span>Official Problem Link:</span>
              <a href="${problemUrl}" target="_blank" rel="noopener noreferrer">${problemUrl}</a>
            </div>
            <div class="quick-link-row">
              <span>Official Editorial Link:</span>
              <a href="${editorialUrl}" target="_blank" rel="noopener noreferrer">${editorialUrl}</a>
            </div>
            <div class="keyboard-legend">
              <span class="key-pill">c</span> Push CPH
              <span class="key-pill">r</span> Reader
              <span class="key-pill">n</span> Notes
              <span class="key-pill">g</span> Gauntlet
              <span class="key-pill">Space</span> Pause
              <span class="key-pill">o</span> AtCoder
              <span class="key-pill">v</span> Verify AC
              <span class="key-pill">Enter</span> Attest AC
              <span class="key-pill">t</span> Reveal Topic
              <span class="key-pill">e</span> Editorial
              <span class="key-pill">1-3</span> Mode
              <span class="key-pill">s</span> Skip
              <span class="key-pill">Esc</span> Table
            </div>
          </div>
        </div>
      </div>
    `;

    this.attachEvents();
  }

  /**
   * Binds UI events and keyboard shortcuts.
   */
  attachEvents() {
    // Mode switcher buttons
    this.container.querySelectorAll('.btn-mode').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.target.dataset.mode;
        if (mode) this.setPracticeMode(mode);
      });
    });

    // Gauntlet run button
    const btnGauntlet = this.container.querySelector('#btn-zen-gauntlet');
    if (btnGauntlet) {
      btnGauntlet.addEventListener('click', () => this.startGauntletRun());
    }

    // Push to CPH / Editor
    const btnCphPush = this.container.querySelector('#btn-zen-cph-push');
    if (btnCphPush) {
      btnCphPush.addEventListener('click', () => this.pushToCPH());
    }

    // Reader toggle
    const btnReader = this.container.querySelector('#btn-zen-reader');
    if (btnReader) {
      btnReader.addEventListener('click', () => this.toggleReader());
    }

    // Notes toggle
    const btnNotes = this.container.querySelector('#btn-zen-notes');
    if (btnNotes) {
      btnNotes.addEventListener('click', () => this.toggleNotes());
    }

    // Resume button in scrim
    const btnResumeScrim = this.container.querySelector('#btn-resume-scrim');
    if (btnResumeScrim) {
      btnResumeScrim.addEventListener('click', () => this.togglePause());
    }

    // Pause button in toolbar
    const btnPause = this.container.querySelector('#btn-zen-pause');
    if (btnPause) {
      btnPause.addEventListener('click', () => this.togglePause());
    }

    // Open AtCoder (in browser)
    const btnCph = this.container.querySelector('#btn-zen-cph');
    if (btnCph) {
      btnCph.addEventListener('click', () => this.openOfficialTask());
    }

    // Verify AC
    const btnVerify = this.container.querySelector('#btn-zen-verify');
    if (btnVerify) {
      btnVerify.addEventListener('click', () => {
        if (btnVerify.classList.contains('btn-attest-pulse')) {
          this.handleSolve(true);
        } else {
          this.handleSolve(false);
        }
      });
    }

    // Reveal topic
    const btnTopic = this.container.querySelector('#btn-zen-reveal-topic');
    if (btnTopic) {
      btnTopic.addEventListener('click', () => this.revealCategory());
    }

    // Editorial
    const btnEd = this.container.querySelector('#btn-zen-editorial');
    if (btnEd) {
      btnEd.addEventListener('click', () => this.openEditorial());
    }

    // Skip
    const btnSkip = this.container.querySelector('#btn-zen-skip');
    if (btnSkip) {
      btnSkip.addEventListener('click', () => this.handleSkip('neutral'));
    }

    // Back to table
    const btnBack = this.container.querySelector('#btn-zen-back');
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        audioEngine.playClick();
        this.destroy();
        this.onExit();
      });
    }
  }

  /**
   * Handles keyboard shortcuts when Zen mode is active.
   */
  handleKeyDown(e) {
    const key = e.key;
    const activeEl = document.activeElement;

    // Guard: allow typing in scratchpad textarea without triggering hotkeys
    if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) {
      if (key === 'Escape') {
        e.preventDefault();
        activeEl.blur();
        if (this.isNotesOpen) this.toggleNotes();
      }
      return;
    }

    // Check if jackpot modal is open
    const jackpotNextBtn = this.container.querySelector('#btn-jackpot-next');
    if (jackpotNextBtn && key === 'Enter') {
      e.preventDefault();
      jackpotNextBtn.click();
      return;
    }

    const gauntletAdvanceBtn = this.container.querySelector('#btn-gauntlet-advance');
    if (gauntletAdvanceBtn && key === 'Enter') {
      e.preventDefault();
      gauntletAdvanceBtn.click();
      return;
    }

    const gauntletBankBtn = this.container.querySelector('#btn-gauntlet-bank');
    if (gauntletBankBtn && key === 'Enter') {
      e.preventDefault();
      gauntletBankBtn.click();
      return;
    }

    const gauntletAscendBtn = this.container.querySelector('#btn-gauntlet-ascend');
    if (gauntletAscendBtn && (key === ' ' || key === 'Space')) {
      e.preventDefault();
      gauntletAscendBtn.click();
      return;
    }

    const attestBtn = this.container.querySelector('#btn-confirm-attest');
    if (attestBtn && key === 'Enter') {
      e.preventDefault();
      attestBtn.click();
      return;
    }

    if (key === ' ' || key === 'p') {
      e.preventDefault();
      this.togglePause();
    } else if (key === 'c') {
      e.preventDefault();
      this.pushToCPH();
    } else if (key === 'g') {
      e.preventDefault();
      this.startGauntletRun();
    } else if (key === 'r') {
      e.preventDefault();
      this.toggleReader();
    } else if (key === 'n') {
      e.preventDefault();
      this.toggleNotes();
    } else if (key === '1') {
      e.preventDefault();
      this.setPracticeMode('speed');
    } else if (key === '2') {
      e.preventDefault();
      this.setPracticeMode('flow');
    } else if (key === '3') {
      e.preventDefault();
      this.setPracticeMode('reach');
    } else if (key === 'o') {
      e.preventDefault();
      this.openOfficialTask();
    } else if (key === 'v') {
      e.preventDefault();
      this.handleSolve(false);
    } else if (key === 't') {
      e.preventDefault();
      this.revealCategory();
    } else if (key === 'e') {
      e.preventDefault();
      this.openEditorial();
    } else if (key === 's') {
      e.preventDefault();
      this.handleSkip('neutral');
    } else if (key === 'Escape') {
      if (this.isReaderOpen) {
        e.preventDefault();
        this.toggleReader();
        return;
      }
      if (this.isNotesOpen) {
        e.preventDefault();
        this.toggleNotes();
        return;
      }
      e.preventDefault();
      this.destroy();
      this.onExit();
    }
  }
}
