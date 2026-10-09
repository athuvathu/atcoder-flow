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
    this.verifyPollInterval = null;
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
    this.onTimerTick = options.onTimerTick || (() => {});
    this.onOpenRatingModal = options.onOpenRatingModal || (() => {});

    this.restoreSession();
  }

  stopVerifyPoller() {
    if (this.verifyPollInterval) {
      clearInterval(this.verifyPollInterval);
      this.verifyPollInterval = null;
    }
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
   * Cleanly ends and clears the active problem / practice session without penalty.
   */
  endSession() {
    this.stopVerifyPoller();
    this.destroy();
    this.currentProblem = null;
    this.elapsedSeconds = 0;
    this.isPaused = false;
    this.sessionSolves = 0;
    this.gauntletState = {
      active: false,
      stage: 1,
      solves: []
    };
    try {
      localStorage.removeItem('atcoder_flow_zen_state');
    } catch (_) {}
    this.onProblemChange(null);
    this.onTimerTick();
  }

  /**
   * Initializes Zen Mode with a selected problem, runs the 350ms reel roll.
   */
  async loadProblem(problem, skipReel = false) {
    this.stopVerifyPoller();
    this.currentProblem = problem;
    this.revealedCategory = false;
    this.primedProblem = null;
    this.statementData = null;

    // Fetch full problem details if needed
    if (!problem.url) {
      const p = flowStore.getProblem(problem.id);
      if (p) this.currentProblem = p;
    }

    // Smart Defaults (Krug's "Don't Make Me Think"):
    // 1. Always open the Problem Statement & Samples immediately when loading a problem.
    // 2. If the user already has saved scratchpad notes for this problem, open Scratchpad alongside it in split-view.
    this.isReaderOpen = true;
    const existingNotes = localStorage.getItem(`atcoder_notes_${this.currentProblem.id}`);
    this.isNotesOpen = Boolean(existingNotes && existingNotes.trim().length > 0);

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
    this.syncWorkbenchPanes();

    // Auto-dispatch problem + test cases to local editor / CPH quietly in background
    this.pushToCPH(true);

    if (!skipReel) {
      this.playSlotReelAnimation();
    } else {
      this.startTimer();
    }

    this.persistSession();
    this.onProblemChange(this.currentProblem);
    this.onTimerTick();
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
    const probCf = atcoderToCodeforces(targetDiff);

    const dummyContests = ['ABC180', 'ABC210', 'ABC240', 'ABC280', 'ABC320', 'ABC360', 'ABC390'];
    let ticks = 0;
    const maxTicks = 8;

    const reelInterval = setInterval(() => {
      ticks++;
      audioEngine.playReelTick();

      const randomContest = dummyContests[Math.floor(Math.random() * dummyContests.length)];
      const randomDiff = Math.floor(800 + Math.random() * 800);

      titleEl.textContent = `[ ${randomContest} // Problem Spinning... ]`;
      diffEl.textContent = `AT DIFF: ${randomDiff}`;
      diffEl.style.color = '#7d8590';

      if (ticks >= maxTicks) {
        clearInterval(reelInterval);
        audioEngine.playClick();
        titleEl.textContent = targetTitle;
        diffEl.textContent = `AT DIFF: ${targetDiff} [≈ CF ${probCf.cfRating} ${probCf.title}]`;
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
        this.onTimerTick();

        if (this.elapsedSeconds % 10 === 0) {
          this.persistSession();
        }
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  destroy() {
    this.stopVerifyPoller();
    this.stopTimer();
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
    const inlinePauseBtn = this.container.querySelector('#btn-zen-inline-pause');
    const statusTag = this.container.querySelector('#zen-status-indicator');

    if (this.isPaused) {
      if (pauseTitle) pauseTitle.textContent = `[ PAUSED · ${this.formatTime(this.elapsedSeconds)} ]`;
      if (pauseOverlay) pauseOverlay.style.display = 'flex';
      if (inlinePauseBtn) inlinePauseBtn.textContent = '▶ Resume';
      if (statusTag) {
        statusTag.textContent = '[ PAUSED ]';
        statusTag.className = 'status-tag status-paused';
      }
    } else {
      if (pauseOverlay) pauseOverlay.style.display = 'none';
      if (inlinePauseBtn) inlinePauseBtn.textContent = '⏸ Pause';
      if (statusTag) {
        statusTag.textContent = '[ RUNNING ]';
        statusTag.className = 'status-tag status-running';
      }
    }

    this.persistSession();
    this.onTimerTick();
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
      const inlinePauseBtn = this.container.querySelector('#btn-zen-inline-pause');
      const statusTag = this.container.querySelector('#zen-status-indicator');
      if (pauseOverlay) pauseOverlay.style.display = 'none';
      if (inlinePauseBtn) inlinePauseBtn.textContent = '⏸ Pause';
      if (statusTag) {
        statusTag.textContent = '[ RUNNING ]';
        statusTag.className = 'status-tag status-running';
      }
    }
    this.updateStopwatchDisplay();
    this.persistSession();
    this.onTimerTick();
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
   * Synchronizes the Statement Reader and Scratchpad Notes panes, supporting side-by-side split view.
   */
  async syncWorkbenchPanes(focusNotes = false) {
    const grid = this.container.querySelector('#zen-workbench-grid');
    const readerDrawer = this.container.querySelector('#zen-reader-drawer');
    const notesDrawer = this.container.querySelector('#zen-notes-drawer');
    const btnReader = this.container.querySelector('#btn-zen-reader');
    const btnNotes = this.container.querySelector('#btn-zen-notes');

    if (btnReader) btnReader.classList.toggle('active', this.isReaderOpen);
    if (btnNotes) btnNotes.classList.toggle('active', this.isNotesOpen);

    if (grid) {
      grid.classList.toggle('split-two-col', this.isReaderOpen && this.isNotesOpen);
      grid.style.display = (this.isReaderOpen || this.isNotesOpen) ? 'grid' : 'none';
    }

    if (readerDrawer) {
      readerDrawer.style.display = this.isReaderOpen ? 'flex' : 'none';
      if (this.isReaderOpen && !readerDrawer.dataset.loadedFor || (this.isReaderOpen && readerDrawer.dataset.loadedFor !== this.currentProblem?.id)) {
        await this.populateReaderPane(readerDrawer);
      }
    }

    if (notesDrawer) {
      notesDrawer.style.display = this.isNotesOpen ? 'flex' : 'none';
      if (this.isNotesOpen) {
        if (notesDrawer.dataset.loadedFor !== this.currentProblem?.id) {
          this.populateNotesPane(notesDrawer);
        }
        if (focusNotes) {
          const textarea = notesDrawer.querySelector('#zen-scratchpad-input');
          if (textarea) textarea.focus();
        }
      }
    }
  }

  /**
   * Toggles the in-app Problem Statement Reader pane.
   */
  async toggleReader() {
    audioEngine.playClick();
    this.isReaderOpen = !this.isReaderOpen;
    await this.syncWorkbenchPanes(false);
  }

  /**
   * Fetches and populates the Statement Reader pane.
   */
  async populateReaderPane(drawer) {
    if (!this.currentProblem) return;
    const probId = this.currentProblem.id;
    drawer.dataset.loadedFor = probId;

    if (this.statementData) {
      this.renderReaderContent(drawer, this.statementData);
      return;
    }

    drawer.innerHTML = `
      <div class="drawer-header">
        <span>TASK STATEMENT & OFFICIAL SAMPLES</span>
        <button id="btn-close-reader" class="btn-drawer-close" title="Collapse Statement [r]">[r] HIDE</button>
      </div>
      <div class="drawer-loading">Fetching official statement from AtCoder...</div>
    `;
    drawer.querySelector('#btn-close-reader')?.addEventListener('click', () => this.toggleReader());

    try {
      const data = await flowStore.fetchStatement(probId);
      if (this.currentProblem?.id !== probId) return;
      this.statementData = data;
      this.renderReaderContent(drawer, data);
    } catch (err) {
      if (this.currentProblem?.id !== probId) return;
      drawer.innerHTML = `
        <div class="drawer-header">
          <span>TASK STATEMENT</span>
          <button id="btn-close-reader" class="btn-drawer-close">[r] HIDE</button>
        </div>
        <div class="drawer-error">
          Could not fetch statement: ${escapeHtml(err.message)}
          <div style="margin-top:12px;">
            <button id="btn-fallback-open" class="btn-primary">[o] OPEN ON ATCODER ↗</button>
          </div>
        </div>
      `;
      drawer.querySelector('#btn-close-reader')?.addEventListener('click', () => this.toggleReader());
      drawer.querySelector('#btn-fallback-open')?.addEventListener('click', () => this.openOfficialTask());
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
          <strong>${escapeHtml(this.currentProblem.title || this.currentProblem.id)}</strong>
          <span class="limit-pill">TL: ${timeLimitSec}s · ML: ${memLimitMb}MB</span>
        </div>
        <div class="drawer-header-actions">
          ${!this.isNotesOpen ? `<button id="btn-open-split-notes" class="btn-drawer-action" title="Open Side-by-Side Scratchpad [n]">+ [n] Split Scratchpad</button>` : ''}
          <button id="btn-close-reader" class="btn-drawer-close" title="Hide Statement [r]">[r] HIDE</button>
        </div>
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

    drawer.querySelector('#btn-close-reader')?.addEventListener('click', () => this.toggleReader());
    drawer.querySelector('#btn-open-split-notes')?.addEventListener('click', () => this.toggleNotes());

    drawer.querySelectorAll('.btn-copy-sample').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.target.dataset.copy;
        const pre = drawer.querySelector(`#sample-${target}`);
        if (pre) {
          navigator.clipboard.writeText(pre.textContent).then(() => {
            const originalText = e.target.textContent;
            e.target.textContent = '✓ COPIED';
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
   * Toggles the inline Scratchpad / Invariants pane (opens side-by-side with Statement).
   */
  toggleNotes() {
    audioEngine.playClick();
    this.isNotesOpen = !this.isNotesOpen;
    this.syncWorkbenchPanes(this.isNotesOpen);
    // Refresh reader header button (+ Split Scratchpad)
    const splitBtn = this.container.querySelector('#btn-open-split-notes');
    if (splitBtn) splitBtn.style.display = this.isNotesOpen ? 'none' : 'inline-flex';
  }

  toggleBookmark() {
    if (!this.currentProblem) return;
    audioEngine.playClick();
    const added = flowStore.toggleReviewBookmark(this.currentProblem.id);
    const btn = this.container.querySelector('#btn-zen-bookmark');
    if (btn) {
      btn.classList.toggle('active', added);
      btn.textContent = added ? '[b] ⚑ IN REVIEW' : '[b] ⚑ BOOKMARK';
    }
    this.showToast(
      added
        ? `Added ${this.currentProblem.id} to Spaced Repetition Review Queue [⚑]`
        : `Removed ${this.currentProblem.id} from Review Queue`,
      'info'
    );
  }

  populateNotesPane(drawer) {
    if (!this.currentProblem) return;
    const probId = this.currentProblem.id;
    drawer.dataset.loadedFor = probId;
    const storageKey = `atcoder_notes_${probId}`;
    const savedNotes = localStorage.getItem(storageKey) || '';
    const reflectionTags = [
      '#missed-observation',
      '#wrong-greedy',
      '#dp-state',
      '#tle-complexity',
      '#edge-case',
      '#key-invariant'
    ];
    drawer.innerHTML = `
      <div class="drawer-header">
        <span>SCRATCHPAD & INVARIANTS // ${escapeHtml(probId.toUpperCase())}</span>
        <button id="btn-close-notes" class="btn-drawer-close" title="Close Scratchpad [n / Esc]">✕ [n]</button>
      </div>
      <div class="notes-tag-bar">
        <span class="notes-tag-lbl">Quick Tag:</span>
        ${reflectionTags.map(t => `<button class="btn-reflection-chip" data-tag="${t}" title="Append ${t} to notes">${t}</button>`).join('')}
      </div>
      <div class="notes-body">
        <textarea id="zen-scratchpad-input" placeholder="Jot invariants, state transitions, complexity bounds, or post-mortem takeaways...">${escapeHtml(savedNotes)}</textarea>
        <div class="notes-footer">
          <span>Auto-saved locally for ${escapeHtml(probId)} (visible in Table 📝)</span>
          <span>Press [Esc] to unfocus editor</span>
        </div>
      </div>
    `;
    drawer.querySelector('#btn-close-notes')?.addEventListener('click', () => this.toggleNotes());
    const textarea = drawer.querySelector('#zen-scratchpad-input');
    if (textarea) {
      textarea.addEventListener('input', (e) => {
        localStorage.setItem(storageKey, e.target.value);
      });
    }
    drawer.querySelectorAll('.btn-reflection-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        audioEngine.playClick();
        const tag = btn.dataset.tag;
        const updated = flowStore.appendProblemNote(probId, `[${tag}] `);
        if (textarea) {
          textarea.value = updated;
          textarea.focus();
        }
      });
    });
  }

  /**
   * Sets practice intensity mode and fetches next problem in that bracket.
   */
  async setPracticeMode(mode) {
    this.activeMode = mode;
    audioEngine.playClick();
    this.showToast(`Pulling ${mode.toUpperCase()} problem...`, 'info');
    try {
      const prob = flowStore.getNextFlowProblem(mode, { excludeId: this.currentProblem?.id });
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
    if (!this.currentProblem) return;
    const solveBtn = this.container.querySelector('#btn-zen-verify');
    if (solveBtn) {
      solveBtn.disabled = true;
      solveBtn.textContent = optimistic ? 'ATTESTING...' : 'VERIFYING...';
    }

    try {
      let isVerified = Boolean(optimistic);
      let checkResult = null;

      // If verifying normally, live-check Kenkoooo recent window (bypasses CloudFront cache & 500-cap)
      if (!optimistic) {
        try {
          checkResult = await flowStore.verifyProblemAC(this.currentProblem.id);
          if (checkResult && checkResult.verified) {
            isVerified = true;
          }
        } catch (netErr) {
          checkResult = { verified: false, reason: 'network_error', error: netErr.message };
        }
      }

      // Case 2: Kenkoooo scraper hasn't indexed the AC yet or returned a non-AC verdict
      if (!isVerified) {
        if (solveBtn) {
          solveBtn.disabled = false;
          solveBtn.textContent = '✓ [v] RETRY VERIFY';
          solveBtn.classList.add('btn-attest-pulse');
        }
        this.showAttestModal(checkResult);
        return;
      }

      // Remove any open attest banner
      const existingBar = this.container.querySelector('.attest-prompt-bar');
      if (existingBar) existingBar.remove();

      this.stopTimer();
      this.stopVerifyPoller();

      if (solveBtn) {
        solveBtn.disabled = false;
        solveBtn.textContent = '✓ [v] VERIFY AC';
        solveBtn.classList.remove('btn-attest-pulse');
      }

      // ===== JACKPOT: Verified or Attested AC =====
      const data = flowStore.recordSolve(this.currentProblem.id, this.elapsedSeconds, optimistic, this.activeMode || 'flow');

      this.sessionSolves++;
      this.trainingRating = data.training_rating;
      this.streak = data.streak;
      this.primedProblem = data.primed_problem;

      // Clear active problem in localStorage
      localStorage.removeItem('atcoder_flow_zen_state');

      // Refresh parent HUD (rating, solved count, table checkmarks, dock) even when Waifu mode is OFF
      if (typeof this.onSolveAC === 'function') {
        this.onSolveAC(data);
      }

      // Trigger multi-stage euphoric feedback
      this.showJackpotCelebration(data);

    } catch (err) {
      this.showToast(`Verification error: ${err.message}`, 'error');
      if (solveBtn) {
        solveBtn.disabled = false;
        solveBtn.textContent = '✓ [v] VERIFY AC';
      }
    }
  }

  /**
   * Shows inline attestation prompt when Kenkoooo is lagging or shows a non-AC submission,
   * and launches a non-blocking 15-second background auto-poller for up to 3 minutes.
   */
  showAttestModal(checkResult = null) {
    this.stopVerifyPoller();
    const existing = this.container.querySelector('.attest-prompt-bar');
    if (existing) existing.remove();

    const handle = checkResult?.handle || flowStore.getUserState().handle || 'atrv';
    const probId = this.currentProblem?.id || '';
    let statusMsg = `AtCoder hides live submissions behind login; Kenkoooo's crawler hasn't indexed <strong>@${escapeHtml(handle)}</strong>'s AC on <code>${escapeHtml(probId)}</code> yet (1–5m lag).`;

    if (checkResult?.reason === 'non_ac' && checkResult.latestSub) {
      const sub = checkResult.latestSub;
      const ageSec = Math.max(0, Math.floor(Date.now() / 1000) - (sub.epoch_second || 0));
      const ageStr = ageSec < 60 ? `${ageSec}s ago` : ageSec < 3600 ? `${Math.floor(ageSec / 60)}m ago` : `${Math.floor(ageSec / 3600)}h ago`;
      statusMsg = `Kenkoooo shows latest submission by <strong>@${escapeHtml(handle)}</strong> on <code>${escapeHtml(probId)}</code> is <span class="verdict-pill verdict-wa">${escapeHtml(sub.result)}</span> (${ageStr}). If you just got Green AC:`;
    } else if (checkResult?.reason === 'network_error') {
      statusMsg = `Could not reach Kenkoooo API (${escapeHtml(checkResult.error || 'offline')}). If you got Green AC on AtCoder:`;
    }

    const bar = document.createElement('div');
    bar.className = 'attest-prompt-bar';
    bar.innerHTML = `
      <div class="attest-prompt-text">
        ${statusMsg}
        <span id="attest-autopoll-status" class="autopoll-badge">Auto-checking Kenkoooo in 15s…</span>
      </div>
      <div class="attest-prompt-actions">
        <button id="btn-retry-verify" class="btn-action-ghost" title="Re-poll Kenkoooo API now [v]">↻ [v] Check Now</button>
        <button id="btn-confirm-attest" class="btn-attest-confirm" title="Immediately record AC and continue [Enter]">⚡ [Enter] Attest AC & Continue</button>
      </div>
    `;

    const workbenchBar = this.container.querySelector('.zen-workbench-toolbar') || this.container.querySelector('.zen-workbench-bar');
    if (workbenchBar && workbenchBar.insertAdjacentElement) {
      workbenchBar.insertAdjacentElement('afterend', bar);
    } else {
      const hero = this.container.querySelector('.zen-wrapper') || this.container;
      hero.prepend(bar);
    }

    const btnConfirm = bar.querySelector('#btn-confirm-attest');
    if (btnConfirm) {
      btnConfirm.addEventListener('click', () => {
        this.stopVerifyPoller();
        bar.remove();
        this.handleSolve(true);
      });
    }
    const btnRetry = bar.querySelector('#btn-retry-verify');
    if (btnRetry) {
      btnRetry.addEventListener('click', () => {
        this.stopVerifyPoller();
        bar.remove();
        this.handleSolve(false);
      });
    }

    // Start non-blocking 15-second background auto-poller (up to 12 attempts / 3 minutes)
    let countdown = 15;
    let attempts = 0;
    const maxAttempts = 12;
    const pollStatusEl = bar.querySelector('#attest-autopoll-status');

    this.verifyPollInterval = setInterval(async () => {
      if (!this.currentProblem || this.currentProblem.id !== probId) {
        this.stopVerifyPoller();
        return;
      }
      countdown--;
      if (countdown > 0) {
        if (pollStatusEl) pollStatusEl.textContent = `Auto-checking Kenkoooo in ${countdown}s…`;
        return;
      }

      attempts++;
      countdown = 15;
      if (pollStatusEl) pollStatusEl.textContent = `Polling Kenkoooo (${attempts}/${maxAttempts})…`;

      try {
        const res = await flowStore.verifyProblemAC(probId);
        if (res && res.verified) {
          this.stopVerifyPoller();
          bar.remove();
          // Trigger verified solve
          this.handleSolve(true);
          return;
        }
      } catch (_) {}

      if (attempts >= maxAttempts) {
        this.stopVerifyPoller();
        if (pollStatusEl) pollStatusEl.textContent = `Auto-poll paused (click ↻ Check Now or ⚡ Attest AC)`;
      }
    }, 1000);
  }

  /**
   * Terminal-grade solve verdict card with AtCoder and Codeforces performance metrics.
   */
  showJackpotCelebration(data) {
    this.stopVerifyPoller();
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
    const waifuEnabled = flowStore.isWaifuModeEnabled();

    const surgeBannerHtml = data.is_critical 
      ? `<div class="surge-badge critical">[ CRITICAL SPEED SURGE: +${data.speed_surge_bonus} BONUS ]</div>`
      : data.is_clutch 
      ? `<div class="surge-badge clutch">[ CLUTCH AC: PAR WINDOW LOCKED ]</div>`
      : '';

    const redemptionBannerHtml = data.was_redemption
      ? `<div class="surge-badge critical">[ ★ UP-SOLVED REDEMPTION // GRADUATED FROM REVIEW QUEUE (+50% XP) ]</div>`
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
        ${redemptionBannerHtml}
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

        ${waifuEnabled ? `
          <div id="ac-reward-card-slot" class="ac-reward-card-slot">
            <div class="ac-reward-loading">🃏 Rolling Waifu.im Artwork Reward Card...</div>
          </div>
        ` : ''}

        <div class="jackpot-next-prompt">
          ${nextPromptHtml}
        </div>
      </div>
    `;

    this.container.appendChild(overlay);

    if (waifuEnabled) {
      const probSnapshot = this.currentProblem;
      flowStore.rollRewardCard(probSnapshot, data).then(card => {
        this.onSolveAC(); // Refresh HUD card count
        const slot = overlay.querySelector('#ac-reward-card-slot');
        if (!slot || !card) return;
        slot.innerHTML = `
          <div class="ac-reward-card-preview" style="border-color:${card.rarityColor};">
            <div class="ac-reward-img-stage" id="ac-reward-img-trigger" title="Click to view Full Window / Fullscreen">
              <img src="${escapeHtml(card.imageUrl)}" alt="Anime Reward Card" class="ac-reward-thumb" />
              <span class="ac-reward-zoom-hint">⛶ CLICK FOR FULL WINDOW</span>
            </div>
            <div class="ac-reward-footer">
              <div class="ac-reward-meta">
                <span class="ac-reward-rarity" style="color:${card.rarityColor};">[ ★ UNLOCKED CARD: ${escapeHtml(card.rarity)} ]</span>
                <strong class="ac-reward-title">${escapeHtml(card.character)}</strong>
                <span class="ac-reward-sub">Art by ${escapeHtml(card.artist)} · Saved to [i] Vault (${flowStore.getCardCollection().length} total)</span>
              </div>
              <div class="ac-reward-btns">
                <button type="button" id="btn-ac-card-fullscreen" class="btn-zen-primary" style="font-size:11px; padding:6px 12px;">⛶ FULL WINDOW</button>
                <a href="${escapeHtml(card.fullUrl)}" target="_blank" rel="noopener" class="btn-action-ghost" style="font-size:11px; padding:6px 10px;">RAW ↗</a>
              </div>
            </div>
          </div>
        `;
        const openFull = () => {
          if (window.__atcoderApp && typeof window.__atcoderApp.openCardLightbox === 'function') {
            window.__atcoderApp.openCardLightbox(card);
          }
        };
        slot.querySelector('#ac-reward-img-trigger')?.addEventListener('click', openFull);
        slot.querySelector('#btn-ac-card-fullscreen')?.addEventListener('click', openFull);
      }).catch(() => {
        const slot = overlay.querySelector('#ac-reward-card-slot');
        if (slot) slot.innerHTML = '';
      });
    }

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
   * Initiates a structured 3-problem Gauntlet Run supporting custom presets.
   */
  startGauntletRun(presetOverride = null) {
    if (presetOverride) {
      flowStore.setGauntletPreset(presetOverride);
    }
    const preset = flowStore.getGauntletPreset();
    this.gauntletState = {
      active: true,
      stage: 1,
      preset,
      solves: [],
      startTime: Date.now()
    };
    audioEngine.playChime();
    const presetLabels = {
      escalation: 'Escalation (-150 → Par → +200)',
      hard_push: 'Hard Push (+150 → +275 → +400)',
      arc_deep: 'ARC Deep Think (3 ARC Tasks)',
      redemption: 'Review Redemption (Up-Solve Queue)'
    };
    this.showToast(`Starting Gauntlet [${presetLabels[preset] || 'Escalation'} · Stage 1/3]...`, 'info');
    this.fetchGauntletStage(1);
  }

  /**
   * Fetches problem tailored for current gauntlet stage and active preset.
   */
  async fetchGauntletStage(stageNum) {
    const preset = this.gauntletState?.preset || flowStore.getGauntletPreset() || 'escalation';
    const baseOffset = flowStore.getDiffOffset();
    let mode = 'flow';
    const opts = { excludeId: this.currentProblem?.id };

    if (preset === 'hard_push') {
      if (stageNum === 1) { mode = 'reach'; }
      else if (stageNum === 2) { mode = 'boss'; }
      else { mode = 'boss'; opts.diffOffset = baseOffset + 150; }
    } else if (preset === 'arc_deep') {
      opts.contestFilter = 'arc';
      mode = stageNum === 1 ? 'flow' : stageNum === 2 ? 'reach' : 'boss';
    } else if (preset === 'redemption') {
      mode = 'review';
    } else {
      const modes = { 1: 'warmup', 2: 'flow', 3: 'boss' };
      mode = modes[stageNum] || 'flow';
    }

    try {
      const prob = flowStore.getNextFlowProblem(mode, opts);
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
   * Skips problem and pulls a fresh unseen problem in the current mode.
   */
  async handleSkip(reason = 'neutral') {
    audioEngine.playClick();
    try {
      const mode = this.activeMode || 'flow';
      const data = flowStore.recordSkip(this.currentProblem?.id, reason, mode);
      localStorage.removeItem('atcoder_flow_zen_state');

      if (data.primed_problem) {
        const diffStr = data.primed_problem.clipped_difficulty || 1200;
        const deltaStr = data.delta !== 0 ? ` (${data.delta > 0 ? '+' : ''}${data.delta} TR)` : '';
        this.showToast(`Skipped -> Next ${mode.toUpperCase()} problem (Diff: ${diffStr})${deltaStr}`, 'info');
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
   * allows 1-click post-mortem failure reflection tags, and records defeat.
   */
  handleGiveUp() {
    if (this.container.querySelector('.zen-giveup-overlay')) return;

    audioEngine.playHeavyThud();
    this.stopTimer();

    const prob = this.currentProblem || {};
    const editorialUrl = prob.editorial_url || `https://atcoder.jp/contests/${prob.contest_id}/editorial`;
    const isGauntlet = Boolean(this.gauntletState && this.gauntletState.active);
    const reflectionTags = [
      '#missed-observation',
      '#wrong-greedy',
      '#dp-state',
      '#tle-complexity',
      '#edge-case'
    ];

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
            <strong class="delta-neg">-15 TR</strong>
          </div>
          <div class="giveup-impact-row">
            <span>SESSION STREAK:</span>
            <strong class="streak-reset">RESET TO 0 AC</strong>
          </div>
          <div class="giveup-impact-row">
            <span>SPACED REPETITION:</span>
            <span style="color:var(--accent-amber)">⚑ QUEUED IN REVIEW LIST</span>
          </div>
        </div>

        <div class="giveup-reflection-box">
          <div class="editorial-hint-text">1-Click Post-Mortem Tag (saves to problem Scratchpad 📝):</div>
          <div class="giveup-reflection-chips">
            ${reflectionTags.map(t => `<button class="btn-reflection-chip" data-tag="${t}">${t}</button>`).join('')}
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

    overlay.querySelectorAll('.btn-reflection-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        audioEngine.playClick();
        btn.classList.toggle('active');
        const tag = btn.dataset.tag;
        if (prob.id) {
          flowStore.appendProblemNote(prob.id, `[Post-Mortem: ${tag}] `);
          this.showToast(`Logged ${tag} to ${prob.id} Scratchpad`, 'info');
        }
      });
    });

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
      const data = flowStore.recordGiveUp(this.currentProblem?.id, this.elapsedSeconds, this.activeMode || 'flow');
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

      this.showToast(`Gave up on problem. TR: ${data.new_tr} (-15). Loading next challenge...`, 'info');

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
    const gauntletPreset = flowStore.getGauntletPreset();
    const inReview = prob.id ? flowStore.isInReviewQueue(prob.id) : false;
    const revCount = flowStore.getReviewQueueCount();

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
              <button id="btn-end-scrim" class="btn-action btn-end-session-bar">[w] ⏹ End Practice Session</button>
              <button id="btn-exit-scrim" class="btn-action-ghost">[Esc] ← Return to Table</button>
            </div>
          </div>
        </div>

        <!-- Top-Left Contextual Navigation & Flow Scope Bar -->
        <nav class="zen-nav-bar">
          <div class="zen-nav-left">
            <button id="btn-zen-nav-back" class="btn-nav-back" title="Return to previous view (timer continues in mini-dock) [Browser Back / Esc]">
              ← Back
            </button>
            <button id="btn-zen-top-end" class="btn-end-session-top" title="Stop timer, end active practice session & return to Table [w]">
              ⏹ End Session
            </button>
            <div class="zen-breadcrumb">
              <span class="crumb-root" id="zen-crumb-root" title="Return to Practice Table">TABLE</span>
              <span class="crumb-sep">/</span>
              <span class="crumb-contest">${contest || 'ATCODER'}</span>
              <span class="crumb-sep">/</span>
              <span class="crumb-problem">${escapeHtml(prob.title || prob.id || '')}</span>
            </div>
            ${domainFilter ? `
              <span class="zen-domain-drill-chip" id="zen-domain-drill-chip">
                <span>DRILL: ${domainFilter.replace(/_/g, ' ').toUpperCase()}</span>
                <button id="btn-zen-clear-domain" class="btn-chip-clear" title="Clear domain drill lock">×</button>
              </span>
            ` : ''}
          </div>

          <div class="zen-nav-right">
            <div class="zen-inline-scope">
              <span class="mode-label">CHANNEL:</span>
              <button class="btn-mode ${this.activeMode === 'speed' ? 'active' : ''}" data-mode="speed" title="Fast fluency drills (-200) [1]">[1] Speed</button>
              <button class="btn-mode ${this.activeMode === 'flow' ? 'active' : ''}" data-mode="flow" title="Optimal challenge at Par rating [2]">[2] Flow</button>
              <button class="btn-mode ${this.activeMode === 'reach' ? 'active' : ''}" data-mode="reach" title="Growth breakthrough challenge (+150) [3]">[3] Reach</button>
              <button class="btn-mode ${this.activeMode === 'review' ? 'active' : ''}" data-mode="review" title="Pull from Spaced Repetition Review Queue [4]">[4] ⚑ Review (${revCount})</button>
              <span class="mode-sep">·</span>
              <div class="contest-btn-group-zen">
                <button class="btn-contest-opt ${contestFilter === 'all' ? 'active' : ''}" data-contest="all" title="All Golden Era [x]">ALL</button>
                <button class="btn-contest-opt ${contestFilter === 'abc' ? 'active' : ''}" data-contest="abc" title="ABC Only [x]">ABC</button>
                <button class="btn-contest-opt ${contestFilter === 'arc' ? 'active' : ''}" data-contest="arc" title="ARC Only [x]">ARC</button>
                <button class="btn-contest-opt ${contestFilter === 'agc' ? 'active' : ''}" data-contest="agc" title="AGC Only [x]">AGC</button>
              </div>
              <span class="mode-sep">·</span>
              <div class="bump-control-cluster" title="Difficulty target offset [- / + / 0]">
                <button id="btn-bump-down" class="btn-bump-btn">-50</button>
                <span id="zen-bump-val" class="bump-val-pill ${diffOffset > 0 ? 'bump-pos' : diffOffset < 0 ? 'bump-neg' : ''}">${diffOffset > 0 ? '+' : ''}${diffOffset}</span>
                <button id="btn-bump-up" class="btn-bump-btn">+50</button>
              </div>
              <select id="zen-gauntlet-preset" class="gauntlet-preset-select" title="Gauntlet Mode Preset">
                <option value="escalation" ${gauntletPreset === 'escalation' ? 'selected' : ''}>Escalation</option>
                <option value="hard_push" ${gauntletPreset === 'hard_push' ? 'selected' : ''}>Hard Push (+150..+400)</option>
                <option value="arc_deep" ${gauntletPreset === 'arc_deep' ? 'selected' : ''}>ARC Deep Think</option>
                <option value="redemption" ${gauntletPreset === 'redemption' ? 'selected' : ''}>Review Redemption</option>
              </select>
              <button id="btn-zen-gauntlet" class="btn-mode-gauntlet ${this.gauntletState && this.gauntletState.active ? 'active' : ''}" title="Launch 3-Stage Gauntlet [g]">[g] Gauntlet</button>
            </div>
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
              <strong id="zen-slot-title" class="task-title">${escapeHtml(prob.title || prob.id)}</strong>
            </div>
            <div class="task-meta-pills">
              <span id="zen-slot-diff" class="diff-badge">AT DIFF: ${prob.clipped_difficulty || 'N/A'} [≈ CF ${atcoderToCodeforces(prob.clipped_difficulty || 1200).cfRating} ${atcoderToCodeforces(prob.clipped_difficulty || 1200).title}]</span>
              <span id="zen-active-contest-pill" class="contest-badge-pill">${contestFilter.toUpperCase()}</span>
              ${diffOffset !== 0 ? `<span id="zen-active-bump-pill" class="diff-bump-pill ${diffOffset > 0 ? 'bump-pos' : 'bump-neg'}">${diffOffset > 0 ? '+' : ''}${diffOffset} BUMP</span>` : `<span id="zen-active-bump-pill" class="diff-bump-pill" style="display:none;"></span>`}
              <span id="zen-topic-tag" class="topic-badge" style="cursor:pointer;" title="Click or press [t] to reveal topic">TOPIC: [HIDDEN // 't']</span>
              <span id="zen-rating-badge" class="rating-badge editable-rating-badge" style="cursor:pointer;" title="Click to manually set Practice Rating or Auto-Calibrate">
                RATING: <strong style="color:${atMeta.color};">${this.trainingRating} ✎</strong>
                <span style="color:${cfMeta.color}; margin-left:4px;">[CF ${cfMeta.cfRating} ${cfMeta.title}]</span>
              </span>
            </div>
          </div>

          <div class="hud-right">
            <!-- Par Race Stopwatch & Exclusive Transport Controls -->
            <div class="stopwatch-cluster">
              <div class="stopwatch-top-row">
                <div id="zen-clock" class="stopwatch-display" title="Click to Pause/Resume [Space]">${this.formatTime(this.elapsedSeconds)}</div>
                <div class="stopwatch-controls">
                  <button id="btn-zen-inline-pause" class="btn-timer-ctrl" title="Pause / Resume Timer [Space]">
                    ${this.isPaused ? '▶ Resume' : '⏸ Pause'}
                  </button>
                  <button id="btn-zen-reset-timer" class="btn-timer-ctrl btn-timer-reset" title="Reset Stopwatch to 00:00 [z]">
                    ↺ Reset
                  </button>
                  <button id="btn-zen-stop-timer" class="btn-timer-ctrl btn-timer-stop" title="Stop & End Practice Session [w]">
                    ⏹ End
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
              <div class="session-solves-badge">STREAK: <strong>${this.streak || this.sessionSolves}</strong></div>
            </div>
          </div>
        </header>

        <!-- Clean Single-Row Workbench Toolbar (Zero Duplicate Buttons) -->
        <div class="zen-workbench-toolbar">
          <div class="workbench-left-tools">
            <button id="btn-zen-reader" class="btn-pane-toggle ${this.isReaderOpen ? 'active' : ''}" title="Toggle Problem Statement & Samples Pane [r]">
              [r] STATEMENT
            </button>
            <button id="btn-zen-notes" class="btn-pane-toggle ${this.isNotesOpen ? 'active' : ''}" title="Toggle Side-by-Side Scratchpad Pane [n]">
              [n] SCRATCHPAD
            </button>
            <button id="btn-zen-bookmark" class="btn-action-ghost ${inReview ? 'active' : ''}" title="Bookmark / Queue problem in Spaced Repetition Review List [b]">
              ${inReview ? '[b] ⚑ IN REVIEW' : '[b] ⚑ BOOKMARK'}
            </button>
            <span class="toolbar-divider"></span>
            <button id="btn-zen-cph-push" class="btn-cph-push" title="Push problem & real samples to local CPH / Competitive Companion [c]">
              [c] CPH PUSH
            </button>
            <button id="btn-zen-cph" class="btn-cph-open" title="Open official AtCoder problem page in new tab [o]">
              [o] ATCODER ↗
            </button>
            <button id="btn-zen-editorial" class="btn-action-ghost" title="Open official AtCoder editorial in new tab [e]">
              [e] EDITORIAL ↗
            </button>
            <button id="btn-zen-reveal-topic" class="btn-action-ghost" title="Reveal algorithmic topic tag [t]">
              [t] TOPIC
            </button>
          </div>

          <div class="workbench-right-verdicts">
            <button id="btn-zen-verify" class="btn-solve-ac" title="Sync & Verify Accepted submission from AtCoder [v]">
              ✓ [v] VERIFY AC
            </button>
            <button id="btn-zen-attest" class="btn-attest-direct" title="Optimistically attest AC immediately without waiting for scraper lag [a]">
              ⚡ [a] ATTEST AC
            </button>
            <span class="toolbar-divider"></span>
            <button id="btn-zen-skip" class="btn-action-ghost" title="Skip to another problem in current channel [s]">
              [s] SKIP →
            </button>
            <button id="btn-zen-giveup" class="btn-action-ghost btn-giveup" title="Surrender problem, view editorial & record defeat [q]">
              [q] GIVE UP
            </button>
            <button id="btn-zen-toolbar-end" class="btn-action-ghost btn-end-session-bar" title="End active practice session without penalty & return to Table [w]">
              [w] ⏹ END SESSION
            </button>
          </div>
        </div>

        <!-- Side-by-Side Split Workbench Grid (Statement Reader + Scratchpad Notes) -->
        <div id="zen-workbench-grid" class="zen-workbench-grid ${this.isReaderOpen && this.isNotesOpen ? 'split-two-col' : ''}">
          <div id="zen-reader-drawer" class="zen-drawer" style="display:${this.isReaderOpen ? 'flex' : 'none'};"></div>
          <div id="zen-notes-drawer" class="zen-drawer" style="display:${this.isNotesOpen ? 'flex' : 'none'};"></div>
        </div>

        <!-- Minimal 1-Line Workbench Footer -->
        <footer class="zen-workbench-footer">
          <div class="footer-links">
            <a href="${problemUrl}" target="_blank" rel="noopener noreferrer">Task: ${escapeHtml(prob.id || '')} ↗</a>
            <span>·</span>
            <a href="${editorialUrl}" target="_blank" rel="noopener noreferrer">Official Editorial ↗</a>
          </div>
          <div class="footer-shortcuts">
            <span><kbd>Space</kbd> Pause</span>
            <span><kbd>z</kbd> Reset 00:00</span>
            <span><kbd>w</kbd> End Session</span>
            <span><kbd>b</kbd> Bookmark ⚑</span>
            <span><kbd>r</kbd> Statement</span>
            <span><kbd>n</kbd> Split Notes</span>
            <span><kbd>v</kbd> Verify AC</span>
            <span><kbd>a</kbd> Attest AC</span>
            <span><kbd>Ctrl+K</kbd> Palette</span>
          </div>
          <button id="btn-zen-end-session" class="btn-end-session-subtle" title="End and clear active problem timer [w]">
            ⏹ End Session
          </button>
        </footer>
      </div>
    `;

    this.attachEvents();
  }

  /**
   * Binds UI events and keyboard shortcuts.
   */
  attachEvents() {
    // Top-left Back button and Breadcrumb Root (keep timer running in background dock!)
    const btnNavBack = this.container.querySelector('#btn-zen-nav-back');
    if (btnNavBack) {
      btnNavBack.addEventListener('click', () => {
        audioEngine.playClick();
        this.onExit();
      });
    }

    const crumbRoot = this.container.querySelector('#zen-crumb-root');
    if (crumbRoot) {
      crumbRoot.addEventListener('click', () => {
        audioEngine.playClick();
        this.onExit('table');
      });
    }

    const triggerEndSession = () => {
      audioEngine.playClick();
      this.endSession();
      this.onExit('table');
    };

    ['#btn-zen-top-end', '#btn-zen-stop-timer', '#btn-zen-toolbar-end', '#btn-end-scrim', '#btn-zen-end-session'].forEach(sel => {
      const btn = this.container.querySelector(sel);
      if (btn) btn.addEventListener('click', triggerEndSession);
    });

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

    // Editable rating badge inside Workbench
    const ratingBadge = this.container.querySelector('#zen-rating-badge');
    if (ratingBadge) {
      ratingBadge.addEventListener('click', () => {
        audioEngine.playClick();
        this.onOpenRatingModal();
      });
    }

    // Bookmark toggle
    const btnBookmark = this.container.querySelector('#btn-zen-bookmark');
    if (btnBookmark) {
      btnBookmark.addEventListener('click', () => this.toggleBookmark());
    }

    // Gauntlet preset selector
    const presetSelect = this.container.querySelector('#zen-gauntlet-preset');
    if (presetSelect) {
      presetSelect.addEventListener('change', (e) => {
        audioEngine.playClick();
        flowStore.setGauntletPreset(e.target.value);
      });
    }

    // Mode switcher buttons
    this.container.querySelectorAll('.btn-mode').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.currentTarget.dataset.mode;
        if (mode) this.setPracticeMode(mode);
      });
    });

    // Contest filter buttons
    this.container.querySelectorAll('.btn-contest-opt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const contest = e.currentTarget.dataset.contest;
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
        this.onExit();
      });
    }

    // Stopwatch clock & inline Pause/Reset controls
    const clockEl = this.container.querySelector('#zen-clock');
    if (clockEl) {
      clockEl.style.cursor = 'pointer';
      clockEl.addEventListener('click', () => this.togglePause());
    }
    const btnInlinePause = this.container.querySelector('#btn-zen-inline-pause');
    if (btnInlinePause) {
      btnInlinePause.addEventListener('click', () => this.togglePause());
    }
    const btnResetTimer = this.container.querySelector('#btn-zen-reset-timer');
    if (btnResetTimer) {
      btnResetTimer.addEventListener('click', () => this.resetTimer());
    }

    // Open AtCoder (in browser)
    const btnCph = this.container.querySelector('#btn-zen-cph');
    if (btnCph) {
      btnCph.addEventListener('click', () => this.openOfficialTask());
    }

    // Verify AC & Direct Attest AC
    const btnVerify = this.container.querySelector('#btn-zen-verify');
    if (btnVerify) {
      btnVerify.addEventListener('click', () => this.handleSolve(false));
    }
    const btnAttest = this.container.querySelector('#btn-zen-attest');
    if (btnAttest) {
      btnAttest.addEventListener('click', () => this.handleSolve(true));
    }

    // Reveal topic (both toolbar button and topic pill)
    const btnTopic = this.container.querySelector('#btn-zen-reveal-topic');
    if (btnTopic) {
      btnTopic.addEventListener('click', () => this.revealCategory());
    }
    const topicTag = this.container.querySelector('#zen-topic-tag');
    if (topicTag) {
      topicTag.addEventListener('click', () => this.revealCategory());
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
  }

  /**
   * Handles keyboard shortcuts when Zen mode is active.
   */
  handleKeyDown(e) {
    const key = e.key;
    const activeEl = document.activeElement;

    // Guard: allow typing in scratchpad textarea without triggering hotkeys
    if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT')) {
      if (key === 'Escape') {
        e.preventDefault();
        activeEl.blur();
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
    } else if (key === 'w' || key === 'W') {
      e.preventDefault();
      audioEngine.playClick();
      this.endSession();
      this.onExit('table');
    } else if (key === 'b' || key === 'B') {
      e.preventDefault();
      this.toggleBookmark();
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
    } else if (key === '4') {
      e.preventDefault();
      this.setPracticeMode('review');
    } else if (key === 'o') {
      e.preventDefault();
      this.openOfficialTask();
    } else if (key === 'v') {
      e.preventDefault();
      this.handleSolve(false);
    } else if (key === 'a' || key === 'A') {
      e.preventDefault();
      this.handleSolve(true);
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
      if (this.isNotesOpen) {
        e.preventDefault();
        this.toggleNotes();
        return;
      }
      e.preventDefault();
      this.onExit();
    }
  }
}
