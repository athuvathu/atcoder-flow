// Zen Flow Mode & Compulsion Loop HUD for AtCoder Practice Platform
// Terminal-grade minimal unixporn styling, Par race, 350ms digital reel roll,
// non-blocking AC verification, and pauseable persistent stopwatch.

import { audioEngine } from './audio.js';
import { atcoderToCodeforces, getAtcoderMeta } from './rating.js';
import { flowStore } from './store.js';

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
    this.onGiveUp = options.onGiveUp || (() => {});
    this.onProblemChange = options.onProblemChange || (() => {});

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
    flowStore.fetchStatement(problem.id)
      .then(d => { if (d && d.statement_html) this.statementData = d; })
      .catch(() => {});

    // Fetch full problem details if needed
    if (!problem.url) {
      const p = flowStore.getProblem(problem.id);
      if (p) this.currentProblem = p;
    }

    // Calibrate Par time
    const diff = this.currentProblem.clipped_difficulty || 1200;
    this.parSeconds = Math.min(2100, Math.max(480, Math.round(600 + (diff - 1000) * 1.5)));

    // Fetch user live training rating and streak
    const user = flowStore.getUserState();
    this.trainingRating = user.training_rating || 1200;
    this.streak = user.streak || 0;

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
    this.updateStopwatchDisplay();

    // Auto-dispatch problem + test cases to local editor / CPH quietly in background
    this.pushToCPH(true);

    if (!skipReel) {
      this.playSlotReelAnimation();
    } else {
      this.startTimer();
    }

    this.persistSession();
    this.onProblemChange(this.currentProblem);
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
    const pauseTitle = this.container.querySelector('#zen-pause-title');
    const pauseBtn = this.container.querySelector('#btn-zen-pause');
    const inlinePauseBtn = this.container.querySelector('#btn-zen-inline-pause');
    const statusTag = this.container.querySelector('#zen-status-indicator');

    if (this.isPaused) {
      if (pauseTitle) pauseTitle.textContent = `[ PAUSED · ${this.formatTime(this.elapsedSeconds)} ]`;
      if (pauseOverlay) pauseOverlay.style.display = 'flex';
      if (pauseBtn) pauseBtn.textContent = '[Space] RESUME';
      if (inlinePauseBtn) inlinePauseBtn.textContent = '▶ Resume';
      if (statusTag) {
        statusTag.textContent = '[ PAUSED ]';
        statusTag.className = 'status-tag status-paused';
      }
    } else {
      if (pauseOverlay) pauseOverlay.style.display = 'none';
      if (pauseBtn) pauseBtn.textContent = '[Space] PAUSE';
      if (inlinePauseBtn) inlinePauseBtn.textContent = '⏸ Pause';
      if (statusTag) {
        statusTag.textContent = '[ RUNNING ]';
        statusTag.className = 'status-tag status-running';
      }
    }

    this.persistSession();
  }

  /**
   * Resets the stopwatch timer for the active problem back to 00:00.
   */
  resetTimer() {
    audioEngine.playClick();
    this.elapsedSeconds = 0;
    if (this.isPaused) {
      this.isPaused = false;
      const pauseOverlay = this.container.querySelector('#zen-pause-overlay');
      const pauseBtn = this.container.querySelector('#btn-zen-pause');
      const inlinePauseBtn = this.container.querySelector('#btn-zen-inline-pause');
      const statusTag = this.container.querySelector('#zen-status-indicator');
      if (pauseOverlay) pauseOverlay.style.display = 'none';
      if (pauseBtn) pauseBtn.textContent = '[Space] PAUSE';
      if (inlinePauseBtn) inlinePauseBtn.textContent = '⏸ Pause';
      if (statusTag) {
        statusTag.textContent = '[ RUNNING ]';
        statusTag.className = 'status-tag status-running';
      }
    }
    this.updateStopwatchDisplay();
    this.persistSession();
    this.showToast('Stopwatch reset to 00:00', 'info');
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
      const data = await flowStore.pushToCPH(this.currentProblem.id);
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
          const data = await flowStore.fetchStatement(this.currentProblem.id);
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
      const prob = flowStore.getNextFlowProblem(mode);
      if (prob && prob.id) {
        this.loadProblem(prob);
      }
    } catch (_) {}
  }

  /**
   * Manually bumps target difficulty offset up or down in Flow or Gauntlet.
   */
  bumpDifficulty(delta) {
    if (delta !== 0) audioEngine.playClick();
    const newOffset = delta === 0 ? flowStore.setDiffOffset(0) : flowStore.bumpDiffOffset(delta);

    // Update bump display in DOM
    const badge = this.container.querySelector('#zen-bump-val');
    if (badge) {
      badge.textContent = newOffset > 0 ? `+${newOffset}` : newOffset;
      badge.className = `bump-val-pill ${newOffset > 0 ? 'bump-pos' : newOffset < 0 ? 'bump-neg' : ''}`;
    }
    const metaPill = this.container.querySelector('#zen-active-bump-pill');
    if (metaPill) {
      if (newOffset !== 0) {
        metaPill.textContent = `${newOffset > 0 ? '+' : ''}${newOffset} BUMP`;
        metaPill.className = `diff-bump-pill ${newOffset > 0 ? 'bump-pos' : 'bump-neg'}`;
        metaPill.style.display = 'inline-flex';
      } else {
        metaPill.style.display = 'none';
      }
    }

    const effTr = Math.round(this.trainingRating + newOffset);
    if (this.elapsedSeconds === 0) {
      // Stopwatch has not started yet, seamlessly roll reel to new target!
      if (this.gauntletState && this.gauntletState.active) {
        this.fetchGauntletStage(this.gauntletState.stage);
        this.showToast(`Difficulty bump: ${newOffset > 0 ? '+' : ''}${newOffset} (Target: ~${effTr}). Pulled new Gauntlet stage!`);
      } else {
        const prob = flowStore.getNextFlowProblem(this.activeMode, { excludeId: this.currentProblem?.id });
        if (prob) {
          this.loadProblem(prob);
          this.showToast(`Difficulty bump: ${newOffset > 0 ? '+' : ''}${newOffset} (Target: ~${effTr}). Pulled new problem!`);
        }
      }
    } else {
      this.showToast(`Difficulty bump: ${newOffset > 0 ? '+' : ''}${newOffset} (Target: ~${effTr}). Applies to next problem [s to skip].`);
    }
  }

  /**
   * Sets contest filter: 'all', 'abc', or 'arc'.
   */
  setContestFilter(contest) {
    audioEngine.playClick();
    const newFilter = flowStore.setContestFilter(contest);

    // Update toggle buttons in DOM
    this.container.querySelectorAll('.btn-contest-opt').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.contest === newFilter);
    });

    const contestPill = this.container.querySelector('#zen-active-contest-pill');
    if (contestPill) {
      contestPill.textContent = newFilter.toUpperCase();
    }

    if (this.elapsedSeconds === 0) {
      if (this.gauntletState && this.gauntletState.active) {
        this.fetchGauntletStage(this.gauntletState.stage);
        this.showToast(`Contest filter: ${newFilter.toUpperCase()}. Pulled new Gauntlet stage!`);
      } else {
        const prob = flowStore.getNextFlowProblem(this.activeMode, { excludeId: this.currentProblem?.id });
        if (prob) {
          this.loadProblem(prob);
          this.showToast(`Contest filter: ${newFilter.toUpperCase()}. Pulled new problem!`);
        }
      }
    } else {
      this.showToast(`Contest filter: ${newFilter.toUpperCase()}. Applies to next problem [s to skip].`);
    }
  }

  /**
   * Cycles contest filter: ALL -> ABC -> ARC -> AGC -> ALL.
   */
  cycleContestFilter() {
    const current = flowStore.getContestFilter();
    const order = ['all', 'abc', 'arc', 'agc'];
    const nextIdx = (order.indexOf(current) + 1) % order.length;
    this.setContestFilter(order[nextIdx]);
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
      // Case 1: Already solved
      if (flowStore.isSolved(this.currentProblem.id)) {
        this.showToast('Problem already recorded as solved.', 'info');
        if (solveBtn) {
          solveBtn.disabled = false;
          solveBtn.textContent = '[v] VERIFY AC';
        }
        await this.handleSkip('neutral');
        return;
      }

      let isVerified = Boolean(optimistic);

      // If verifying normally, check Kenkoooo
      if (!optimistic) {
        try {
          const syncData = await flowStore.syncKenkoooo();
          if (flowStore.isSolved(this.currentProblem.id) || (syncData.new_ac && syncData.new_ac.includes(this.currentProblem.id))) {
            isVerified = true;
          }
        } catch (_) {}
      }

      // Case 2: Kenkoooo API lag detected — allow immediate 1-key attestation
      if (!isVerified) {
        if (solveBtn) {
          solveBtn.disabled = false;
          solveBtn.textContent = '[Enter] ATTEST AC';
          solveBtn.classList.add('btn-attest-pulse');
        }
        this.showAttestModal();
        return;
      }

      // ===== JACKPOT: Verified or Attested AC =====
      const data = flowStore.recordSolve(this.currentProblem.id, this.elapsedSeconds, optimistic);

      this.sessionSolves++;
      this.trainingRating = data.training_rating;
      this.streak = data.streak;
      this.primedProblem = data.primed_problem;

      // Clear active problem in localStorage
      localStorage.removeItem('atcoder_flow_zen_state');

      // Trigger multi-stage euphoric feedback
      this.showJackpotCelebration(data);

    } catch (err) {
      this.showToast(`Verification error: ${err.message}`, 'error');
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
    const offset = flowStore.getDiffOffset();
    const contest = flowStore.getContestFilter().toUpperCase();
    const offsetStr = offset !== 0 ? ` · Bump: ${offset > 0 ? '+' : ''}${offset}` : '';
    this.showToast(`Starting 3-Problem Flow Gauntlet [Stage 1 Warmup] · Contest: ${contest}${offsetStr}...`, 'info');
    this.fetchGauntletStage(1);
  }

  /**
   * Fetches problem tailored for current gauntlet stage.
   */
  async fetchGauntletStage(stageNum) {
    const modes = { 1: 'warmup', 2: 'flow', 3: 'boss' };
    const mode = modes[stageNum] || 'flow';
    try {
      const prob = flowStore.getNextFlowProblem(mode);
      if (prob && prob.id) {
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
      const data = flowStore.recordSkip(this.currentProblem.id, reason);
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
   * Prompts user to confirm giving up, pauses clock, reveals solution/editorial,
   * recalibrates rating honestly, and records defeat.
   */
  handleGiveUp() {
    if (this.container.querySelector('.zen-giveup-overlay')) return;

    audioEngine.playHeavyThud();
    this.stopTimer();

    const prob = this.currentProblem || {};
    const editorialUrl = prob.editorial_url || `https://atcoder.jp/contests/${prob.contest_id}/editorial`;
    const isGauntlet = Boolean(this.gauntletState && this.gauntletState.active);

    const overlay = document.createElement('div');
    overlay.className = 'zen-jackpot-overlay zen-giveup-overlay';

    overlay.innerHTML = `
      <div class="jackpot-card giveup-card">
        <div class="giveup-header">
          <div class="giveup-verdict">[ SURRENDER // GAVE UP ]</div>
          <span class="giveup-badge">TIME: ${this.formatTime(this.elapsedSeconds)}</span>
        </div>

        ${isGauntlet ? `<div class="gauntlet-failed-banner">[ GAUNTLET RUN FAILED AT STAGE ${this.gauntletState.stage}/3 ]</div>` : ''}

        <div class="jackpot-task">${prob.title || prob.id}</div>

        <div class="task-meta-pills" style="margin: 12px 0;">
          <span class="diff-badge">DIFF: ${prob.clipped_difficulty || 'N/A'}</span>
          <span class="topic-badge topic-revealed" style="color:var(--accent-amber); border:1px solid rgba(255,184,54,0.4);">
            TOPIC: ${prob.category || 'General Problem Solving'}
          </span>
        </div>

        <div class="giveup-impact-box">
          <div class="giveup-impact-row">
            <span>RATING ADJUSTMENT:</span>
            <strong class="delta-neg">-20 TR</strong>
          </div>
          <div class="giveup-impact-row">
            <span>SESSION STREAK:</span>
            <strong class="streak-reset">RESET TO 0 AC</strong>
          </div>
          <div class="giveup-impact-row">
            <span>SPACED REPETITION:</span>
            <span style="color:var(--text-secondary)">QUEUED FOR REVIEW</span>
          </div>
        </div>

        <div class="giveup-editorial-cluster">
          <div class="editorial-hint-text">Study the approach before continuing:</div>
          <a href="${editorialUrl}" target="_blank" rel="noopener noreferrer" class="btn-giveup-editorial" id="btn-giveup-open-ed">
            [e] Read Official Editorial
          </a>
        </div>

        <div class="jackpot-action-btns" style="margin-top:20px;">
          <button id="btn-giveup-confirm" class="btn-jackpot-launch">
            ${isGauntlet ? '[Enter] Terminate Gauntlet' : '[Enter] Confirm & Load Next Problem'}
          </button>
          <button id="btn-giveup-cancel" class="btn-jackpot-ghost">
            [Esc] Resume Attempt
          </button>
        </div>
      </div>
    `;

    this.container.appendChild(overlay);

    const confirmBtn = overlay.querySelector('#btn-giveup-confirm');
    const cancelBtn = overlay.querySelector('#btn-giveup-cancel');

    if (confirmBtn) {
      confirmBtn.focus();
      confirmBtn.addEventListener('click', () => {
        overlay.remove();
        this.executeGiveUp();
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        overlay.remove();
        this.startTimer();
      });
    }
  }

  /**
   * Finalizes giving up, records state, updates rating, and transitions to next problem.
   */
  async executeGiveUp() {
    audioEngine.playHeavyThud();
    const isGauntlet = Boolean(this.gauntletState && this.gauntletState.active);

    try {
      const data = flowStore.recordGiveUp(this.currentProblem?.id, this.elapsedSeconds);
      localStorage.removeItem('atcoder_flow_zen_state');

      this.trainingRating = data.new_tr;
      this.streak = 0;
      this.sessionSolves = 0;

      if (typeof this.onGiveUp === 'function') {
        this.onGiveUp(data);
      }

      if (isGauntlet) {
        this.gauntletState = { active: false, stage: 1, solves: [] };
        this.showToast('Gauntlet run terminated. Problem queued for future review.', 'info');
        this.destroy();
        this.onExit();
        return;
      }

      this.showToast(`Gave up on problem. TR: ${data.new_tr} (-20). Loading next challenge...`, 'info');

      if (data.primed_problem) {
        this.loadProblem(data.primed_problem);
      } else {
        this.destroy();
        this.onExit();
      }
    } catch (err) {
      this.showToast(`Error: ${err.message}`, 'error');
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
    const diffOffset = flowStore.getDiffOffset();
    const contestFilter = flowStore.getContestFilter();
    const domainFilter = flowStore.getDomainFilter();

    this.container.innerHTML = `
      <div class="zen-wrapper">
        <!-- Ghost Pacer Hairline Track -->
        <div class="ghost-pacer-track" title="Ghost Pacer: Live Par pacing bar">
          <div id="ghost-pacer-fill" class="ghost-pacer-fill"></div>
        </div>

        <!-- Paused Screen Scrim -->
        <div id="zen-pause-overlay" class="zen-pause-scrim" style="display: ${this.isPaused ? 'flex' : 'none'};">
          <div class="pause-card">
            <div id="zen-pause-title" class="pause-title">[ PAUSED · ${this.formatTime(this.elapsedSeconds)} ]</div>
            <div class="pause-subtitle">Timer and metrics are frozen. Take your time.</div>
            <div class="pause-scrim-actions">
              <button id="btn-resume-scrim" class="btn-primary">[Space] ▶ Resume Practice</button>
              <button id="btn-reset-scrim" class="btn-action">[z] ↺ Reset Timer (00:00)</button>
              <button id="btn-exit-scrim" class="btn-action-ghost">[Esc] ← Exit Workspace</button>
            </div>
          </div>
        </div>

        <!-- Top-Left Contextual Navigation & Breadcrumb Bar -->
        <nav class="zen-nav-bar">
          <div class="zen-nav-left">
            <button id="btn-zen-nav-back" class="btn-nav-back" title="Return to previous view [Browser Back / Esc]">
              ← Back
            </button>
            <div class="zen-breadcrumb">
              <span class="crumb-root" id="zen-crumb-root" title="Return to Practice Table">TABLE</span>
              <span class="crumb-sep">/</span>
              <span class="crumb-contest">${contest || 'ATCODER'}</span>
              <span class="crumb-sep">/</span>
              <span class="crumb-problem">${escapeHtml(prob.title || prob.id || '')}</span>
            </div>
          </div>
          <div class="zen-nav-right">
            ${domainFilter ? `
              <span class="active-domain-chip" id="zen-domain-drill-chip">
                <span>DRILL: ${domainFilter.replace(/_/g, ' ').toUpperCase()}</span>
                <button id="btn-zen-clear-domain" class="btn-clear-domain" title="Clear domain drill lock">×</button>
              </span>
            ` : ''}
            <span class="zen-nav-hint">[z] Reset Timer · [Space] Pause · [Esc] Back</span>
          </div>
        </nav>

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
              <span id="zen-active-contest-pill" class="contest-badge-pill">${contestFilter.toUpperCase()}</span>
              ${diffOffset !== 0 ? `<span id="zen-active-bump-pill" class="diff-bump-pill ${diffOffset > 0 ? 'bump-pos' : 'bump-neg'}">${diffOffset > 0 ? '+' : ''}${diffOffset} BUMP</span>` : `<span id="zen-active-bump-pill" class="diff-bump-pill" style="display:none;"></span>`}
              <span id="zen-topic-tag" class="topic-badge">TOPIC: [HIDDEN // 't']</span>
              <span class="rating-badge">PERF: <strong style="color:${atMeta.color};">${this.trainingRating}</strong> <span style="color:${cfMeta.color}; margin-left:4px;">[CF ${cfMeta.cfRating} ${cfMeta.title}]</span></span>
            </div>
          </div>

          <div class="hud-right">
            <!-- Par Race Stopwatch & Direct Transport Controls -->
            <div class="stopwatch-cluster">
              <div class="stopwatch-top-row">
                <div id="zen-clock" class="stopwatch-display">${this.formatTime(this.elapsedSeconds)}</div>
                <div class="stopwatch-controls">
                  <button id="btn-zen-inline-pause" class="btn-timer-ctrl" title="Pause / Resume Timer [Space]">
                    ${this.isPaused ? '▶ Resume' : '⏸ Pause'}
                  </button>
                  <button id="btn-zen-reset-timer" class="btn-timer-ctrl btn-timer-reset" title="Reset Stopwatch to 00:00 [z]">
                    ↺ Reset
                  </button>
                </div>
              </div>
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

        <!-- Training Intensity & Scope Selector -->
        <div class="zen-mode-selector">
          <span class="mode-label">INTENSITY:</span>
          <button class="btn-mode ${this.activeMode === 'speed' ? 'active' : ''}" data-mode="speed" title="Fast fluency drills (-200)">[1] Speed</button>
          <button class="btn-mode ${this.activeMode === 'flow' ? 'active' : ''}" data-mode="flow" title="Optimal challenge at Par rating">[2] Flow</button>
          <button class="btn-mode ${this.activeMode === 'reach' ? 'active' : ''}" data-mode="reach" title="Growth breakthrough challenge (+150)">[3] Reach</button>
          <span class="mode-sep">|</span>
          <span class="mode-label">CONTEST:</span>
          <div class="contest-btn-group-zen">
            <button class="btn-contest-opt ${contestFilter === 'all' ? 'active' : ''}" data-contest="all" title="All Golden Era (ABC 150+, ARC 100+, AGC, DP) [x]">ALL</button>
            <button class="btn-contest-opt ${contestFilter === 'abc' ? 'active' : ''}" data-contest="abc" title="ABC Only (ABC 150+) [x]">ABC</button>
            <button class="btn-contest-opt ${contestFilter === 'arc' ? 'active' : ''}" data-contest="arc" title="ARC Only (ARC 100+) [x]">ARC</button>
            <button class="btn-contest-opt ${contestFilter === 'agc' ? 'active' : ''}" data-contest="agc" title="AGC Only (AtCoder Grand Contest) [x]">AGC</button>
          </div>
          <span class="mode-sep">|</span>
          <span class="mode-label">BUMP:</span>
          <div class="bump-control-cluster">
            <button id="btn-bump-down" class="btn-bump-btn" title="Decrease difficulty target by 50 [-]">-50</button>
            <span id="zen-bump-val" class="bump-val-pill ${diffOffset > 0 ? 'bump-pos' : diffOffset < 0 ? 'bump-neg' : ''}" title="Difficulty target offset. Click or press [0] to reset">${diffOffset > 0 ? '+' : ''}${diffOffset}</span>
            <button id="btn-bump-up" class="btn-bump-btn" title="Increase difficulty target by 50 [= or +]">+50</button>
          </div>
          <span class="mode-sep">|</span>
          <button id="btn-zen-gauntlet" class="btn-mode-gauntlet ${this.gauntletState && this.gauntletState.active ? 'active' : ''}" title="Launch structured 3-problem Gauntlet Run [g]">[g] Gauntlet Run (3-Stage)</button>
        </div>

        <!-- Principled Grouped Action Toolbar -->
        <div class="zen-action-cluster">
          <div class="primary-actions">
            <div class="action-group">
              <span class="action-group-label">WORKSPACE</span>
              <button id="btn-zen-reader" class="btn-reader-toggle" title="Read problem statement & copy samples [r]">
                [r] READER
              </button>
              <button id="btn-zen-cph-push" class="btn-cph-push" title="Push problem & real samples directly to CPH / Editor [c]">
                [c] CPH PUSH
              </button>
              <button id="btn-zen-notes" class="btn-notes-toggle" title="Scratchpad & invariants [n]">
                [n] NOTES
              </button>
              <button id="btn-zen-cph" class="btn-cph-open" title="Open official AtCoder problem page in browser [o]">
                [o] ATCODER ↗
              </button>
            </div>

            <div class="action-group">
              <span class="action-group-label">VERDICT & TIMER</span>
              <button id="btn-zen-verify" class="btn-solve-ac" title="Verify submission on AtCoder [v]">
                [v] VERIFY AC
              </button>
              <button id="btn-zen-pause" class="btn-action" title="Pause or Resume Stopwatch [Space]">
                ${this.isPaused ? '[Space] RESUME' : '[Space] PAUSE'}
              </button>
              <button id="btn-zen-reset-bar" class="btn-action" title="Reset Stopwatch to 00:00 [z]">
                [z] RESET 00:00
              </button>
            </div>
          </div>

          <div class="secondary-actions">
            <span class="action-group-label">ASSIST & FLOW</span>
            <button id="btn-zen-reveal-topic" class="btn-action-ghost" title="Anti-spoiler topic reveal [t]">
              [t] TOPIC
            </button>
            <button id="btn-zen-editorial" class="btn-action-ghost" title="Open official editorial [e]">
              [e] EDITORIAL
            </button>
            <button id="btn-zen-skip" class="btn-action-ghost" title="Skip to next problem [s]">
              [s] SKIP →
            </button>
            <button id="btn-zen-giveup" class="btn-action-ghost btn-giveup" title="Surrender problem, reveal solution & record defeat [q]">
              [q] GIVE UP
            </button>
            <button id="btn-zen-back" class="btn-action-ghost" title="Back to previous view [Esc]">
              [Esc] ← BACK
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
            <span style="color:var(--text-muted)">Press [r] to read statement · Press [z] to reset timer · Press [v] when accepted</span>
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
              <span class="key-pill">r</span> Reader
              <span class="key-pill">c</span> Push CPH
              <span class="key-pill">n</span> Notes
              <span class="key-pill">Space</span> Pause
              <span class="key-pill">z</span> Reset Timer
              <span class="key-pill">v</span> Verify AC
              <span class="key-pill">Enter</span> Attest AC
              <span class="key-pill">o</span> AtCoder
              <span class="key-pill">t</span> Topic
              <span class="key-pill">e</span> Editorial
              <span class="key-pill">s</span> Skip
              <span class="key-pill">q</span> Give Up
              <span class="key-pill">+/-</span> Bump Diff
              <span class="key-pill">x</span> Contest
              <span class="key-pill">g</span> Gauntlet
              <span class="key-pill">Esc</span> Back
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
    // Top-left Back button and Breadcrumb Root
    const btnNavBack = this.container.querySelector('#btn-zen-nav-back');
    if (btnNavBack) {
      btnNavBack.addEventListener('click', () => {
        audioEngine.playClick();
        this.destroy();
        this.onExit();
      });
    }

    const crumbRoot = this.container.querySelector('#zen-crumb-root');
    if (crumbRoot) {
      crumbRoot.addEventListener('click', () => {
        audioEngine.playClick();
        this.destroy();
        this.onExit('table');
      });
    }

    const btnClearDomain = this.container.querySelector('#btn-zen-clear-domain');
    if (btnClearDomain) {
      btnClearDomain.addEventListener('click', () => {
        audioEngine.playClick();
        flowStore.setDomainFilter(null);
        const chip = this.container.querySelector('#zen-domain-drill-chip');
        if (chip) chip.remove();
        this.showToast('Cleared domain drill filter');
      });
    }

    // Mode switcher buttons
    this.container.querySelectorAll('.btn-mode').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.target.dataset.mode;
        if (mode) this.setPracticeMode(mode);
      });
    });

    // Contest filter buttons
    this.container.querySelectorAll('.btn-contest-opt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const contest = e.target.dataset.contest;
        if (contest) this.setContestFilter(contest);
      });
    });

    // Difficulty bump controls
    const btnBumpDown = this.container.querySelector('#btn-bump-down');
    if (btnBumpDown) {
      btnBumpDown.addEventListener('click', () => this.bumpDifficulty(-50));
    }
    const btnBumpUp = this.container.querySelector('#btn-bump-up');
    if (btnBumpUp) {
      btnBumpUp.addEventListener('click', () => this.bumpDifficulty(50));
    }
    const bumpValBadge = this.container.querySelector('#zen-bump-val');
    if (bumpValBadge) {
      bumpValBadge.addEventListener('click', () => this.bumpDifficulty(0));
    }

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

    // Scrim controls (Resume, Reset, Exit)
    const btnResumeScrim = this.container.querySelector('#btn-resume-scrim');
    if (btnResumeScrim) {
      btnResumeScrim.addEventListener('click', () => this.togglePause());
    }
    const btnResetScrim = this.container.querySelector('#btn-reset-scrim');
    if (btnResetScrim) {
      btnResetScrim.addEventListener('click', () => this.resetTimer());
    }
    const btnExitScrim = this.container.querySelector('#btn-exit-scrim');
    if (btnExitScrim) {
      btnExitScrim.addEventListener('click', () => {
        audioEngine.playClick();
        this.destroy();
        this.onExit();
      });
    }

    // Pause buttons (toolbar & inline stopwatch)
    const btnPause = this.container.querySelector('#btn-zen-pause');
    if (btnPause) {
      btnPause.addEventListener('click', () => this.togglePause());
    }
    const btnInlinePause = this.container.querySelector('#btn-zen-inline-pause');
    if (btnInlinePause) {
      btnInlinePause.addEventListener('click', () => this.togglePause());
    }

    // Reset Timer buttons (inline stopwatch & toolbar)
    const btnResetTimer = this.container.querySelector('#btn-zen-reset-timer');
    if (btnResetTimer) {
      btnResetTimer.addEventListener('click', () => this.resetTimer());
    }
    const btnResetBar = this.container.querySelector('#btn-zen-reset-bar');
    if (btnResetBar) {
      btnResetBar.addEventListener('click', () => this.resetTimer());
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

    // Give up
    const btnGiveUp = this.container.querySelector('#btn-zen-giveup');
    if (btnGiveUp) {
      btnGiveUp.addEventListener('click', () => this.handleGiveUp());
    }

    // Skip
    const btnSkip = this.container.querySelector('#btn-zen-skip');
    if (btnSkip) {
      btnSkip.addEventListener('click', () => this.handleSkip('neutral'));
    }

    // Back to previous view
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

    // Check if giveup modal is open
    const giveupConfirmBtn = this.container.querySelector('#btn-giveup-confirm');
    const giveupCancelBtn = this.container.querySelector('#btn-giveup-cancel');
    const giveupEdBtn = this.container.querySelector('#btn-giveup-open-ed');
    if (giveupConfirmBtn) {
      if (key === 'Enter') {
        e.preventDefault();
        giveupConfirmBtn.click();
        return;
      }
      if (key === 'Escape' && giveupCancelBtn) {
        e.preventDefault();
        giveupCancelBtn.click();
        return;
      }
      if (key === 'e' && giveupEdBtn) {
        e.preventDefault();
        giveupEdBtn.click();
        return;
      }
      return;
    }

    if (key === ' ' || key === 'p') {
      e.preventDefault();
      this.togglePause();
    } else if (key === 'z' || key === 'Z') {
      e.preventDefault();
      this.resetTimer();
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
    } else if (key === '+' || key === '=' || key === ']') {
      e.preventDefault();
      this.bumpDifficulty(50);
    } else if (key === '-' || key === '_' || key === '[') {
      e.preventDefault();
      this.bumpDifficulty(-50);
    } else if (key === '0') {
      e.preventDefault();
      this.bumpDifficulty(0);
    } else if (key === 'x' || key === 'X') {
      e.preventDefault();
      this.cycleContestFilter();
    } else if (key === 'q' || key === 'Q') {
      e.preventDefault();
      this.handleGiveUp();
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
