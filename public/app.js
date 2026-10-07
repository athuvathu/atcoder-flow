// Main Single-Page Application Controller for AtCoder Practice Platform
import { audioEngine } from './audio.js';
import { PracticeTable } from './table.js';
import { ZenFlowHUD } from './zen.js';
import { TechTreeVisualizer } from './tech_tree.js';
import { atcoderToCodeforces, getAtcoderMeta } from './rating.js';
import { flowStore, CORE_DOMAINS, parseRouteHash, buildRouteHash } from './store.js';

class AtCoderFlowApp {
  constructor() {
    this.currentView = 'table'; // 'table' | 'techtree' | 'zen'
    this.navHistoryDepth = 0;
    this._isRouting = false;
    this.userState = {
      handle: 'atrv',
      streak: 0,
      xp: 0,
      training_rating: 1200,
      multiplier: 1.0,
      solved_count: 0
    };

    // Sub-controllers
    this.table = null;
    this.zen = null;
    this.techTree = null;
  }

  async init() {
    await flowStore.init();
    this.setupDOM();
    this.initControllers();
    this.attachGlobalKeynav();
    this.attachHeaderEvents();
    await this.fetchUserState();
    await this.fetchUserPreferences();
    this.initRouter();
  }

  setupDOM() {
    const root = document.getElementById('app-container');
    if (!root) return;

    root.innerHTML = `
      <div class="cad-grid-overlay"></div>

      <!-- Terminal Header HUD -->
      <header class="app-header">
        <div class="brand-section">
          <div class="brand-title">
            <span>ATCODER FLOW</span>
            <span class="brand-badge">TERMINAL v2.0</span>
          </div>

          <div class="view-tabs">
            <button class="tab-btn active" data-view="table">PRACTICE TABLE</button>
            <button class="tab-btn" data-view="techtree">TECH TREE</button>
            <button class="tab-btn" data-view="zen" id="tab-zen-btn">⚡ FLOW WORKSPACE</button>
          </div>
        </div>

        <div class="hud-metrics">
          <div class="metric-pill handle-badge" id="hud-handle-pill" style="cursor:pointer;" title="Change AtCoder handle [u]">
            <span>USER:</span>
            <strong id="hud-handle-val">atrv</strong>
          </div>
          <div class="metric-pill streak">
            <span>STREAK:</span>
            <strong id="hud-streak-val">0</strong>
          </div>
          <div class="metric-pill rating" id="hud-rating-pill" title="AtCoder training rating and Codeforces equivalent">
            <span>RATING:</span>
            <strong id="hud-rating-val" style="color:var(--accent-cyan)">1200</strong>
            <span id="hud-cf-val" class="hud-cf-badge" style="color:#4a90e2; margin-left:4px;">[CF 1680 Expert]</span>
          </div>
          <div class="metric-pill solved">
            <span>SOLVED:</span>
            <strong id="hud-solved-val">0 AC</strong>
          </div>
        </div>

        <div class="header-actions">
          <button id="btn-gauntlet-session" class="btn-gauntlet-launch" title="Launch 3-Problem Flow Gauntlet (Warmup -> Flow -> Boss) [g]">
            [g] GAUNTLET
          </button>
          <button id="btn-flow-session" class="btn-flow-launch" title="Launch instant flow session [f]">
            [f] FLOW
          </button>
          <button id="btn-sync-kenkoooo" class="btn-icon" title="Sync submissions from AtCoder / Kenkoooo [v]">
            <span id="btn-sync-label">[v] SYNC</span>
          </button>
          <button id="btn-toggle-mute" class="btn-icon" title="Toggle Mechanical Audio [m]">
            <span id="btn-audio-label">[m] AUDIO: ON</span>
          </button>
          <button id="btn-shortcuts-modal" class="btn-icon" title="Keyboard Shortcuts & Workflow Reference [?]">
            <span>[?] KEYS</span>
          </button>
        </div>
      </header>

      <!-- View Containers -->
      <main id="main-view-container" style="display:flex; flex-direction:column; gap:20px;">
        <div id="view-table-section"></div>
        <div id="view-techtree-section" style="display:none;"></div>
        <div id="view-zen-section" style="display:none;"></div>
      </main>

      <!-- Persistent Active Problem Mini-Dock (visible on Table & Tech Tree when a problem timer is active) -->
      <div id="active-session-dock" class="active-session-dock" style="display:none;"></div>

      <!-- Global Keyboard Shortcuts & Workflow Modal -->
      <div id="shortcuts-modal-overlay" class="shortcuts-modal-overlay" style="display:none;">
        <div class="shortcuts-modal-card">
          <div class="shortcuts-modal-header">
            <div>
              <strong>KEYBOARD SHORTCUTS & WORKFLOW HUD</strong>
              <span class="shortcuts-sub">Designed for zero-mouse competitive programming flow</span>
            </div>
            <button id="btn-close-shortcuts" class="btn-drawer-close">[Esc / ?] CLOSE</button>
          </div>
          <div class="shortcuts-grid">
            <div class="shortcuts-col">
              <h4>GLOBAL & PRACTICE TABLE</h4>
              <div class="shortcut-row"><kbd>j</kbd> / <kbd>k</kbd> <span>Move selection Down / Up in Table</span></div>
              <div class="shortcut-row"><kbd>Enter</kbd> <span>Open selected problem in Workbench</span></div>
              <div class="shortcut-row"><kbd>f</kbd> <span>Pull instant Flow problem (at your Par rating)</span></div>
              <div class="shortcut-row"><kbd>1</kbd> / <kbd>2</kbd> / <kbd>3</kbd> <span>Pull Speed (-200) / Flow (Par) / Reach (+150)</span></div>
              <div class="shortcut-row"><kbd>g</kbd> <span>Launch 3-Stage Gauntlet Run</span></div>
              <div class="shortcut-row"><kbd>v</kbd> <span>Sync AC submissions from AtCoder / Kenkoooo</span></div>
              <div class="shortcut-row"><kbd>u</kbd> <span>Switch active AtCoder handle</span></div>
              <div class="shortcut-row"><kbd>m</kbd> <span>Toggle procedural mechanical audio</span></div>
              <div class="shortcut-row"><kbd>Alt+←</kbd> <span>Browser Back through views & filters</span></div>
            </div>
            <div class="shortcuts-col">
              <h4>PROBLEM WORKBENCH & STOPWATCH</h4>
              <div class="shortcut-row"><kbd>Space</kbd> / <kbd>p</kbd> <span>Pause / Resume Stopwatch Timer</span></div>
              <div class="shortcut-row"><kbd>z</kbd> <span>Reset Stopwatch Timer to 00:00</span></div>
              <div class="shortcut-row"><kbd>w</kbd> <span>End active practice session & stop timer</span></div>
              <div class="shortcut-row"><kbd>r</kbd> <span>Toggle Problem Statement & Sample Cases</span></div>
              <div class="shortcut-row"><kbd>n</kbd> <span>Toggle Side-by-Side Split Scratchpad</span></div>
              <div class="shortcut-row"><kbd>v</kbd> <span>Verify AC via AtCoder / Kenkoooo API</span></div>
              <div class="shortcut-row"><kbd>a</kbd> <span>Optimistically Attest AC immediately</span></div>
              <div class="shortcut-row"><kbd>c</kbd> <span>Push problem + samples to local CPH editor</span></div>
              <div class="shortcut-row"><kbd>o</kbd> / <kbd>e</kbd> <span>Open official AtCoder Task / Editorial ↗</span></div>
              <div class="shortcut-row"><kbd>t</kbd> <span>Reveal hidden algorithmic topic tag</span></div>
              <div class="shortcut-row"><kbd>s</kbd> / <kbd>q</kbd> <span>Skip problem / Give Up & view editorial</span></div>
              <div class="shortcut-row"><kbd>-</kbd> / <kbd>+</kbd> / <kbd>0</kbd> <span>Bump target difficulty (-50 / +50 / Reset)</span></div>
              <div class="shortcut-row"><kbd>Esc</kbd> <span>Return to previous view (timer stays in dock)</span></div>
            </div>
          </div>
        </div>
      </div>

      <div class="toast-container" id="toast-container"></div>
    `;
  }

  initControllers() {
    const tableEl = document.getElementById('view-table-section');
    const zenEl = document.getElementById('view-zen-section');
    const treeEl = document.getElementById('view-techtree-section');

    this.table = new PracticeTable(tableEl, {
      onProblemSelect: (prob) => this.openZenMode(prob),
      onFilterChange: (filters) => {
        if (!this._isRouting) {
          this.navigateTo(buildRouteHash({ view: 'table', ...filters }));
        }
      },
      onAudioClick: () => audioEngine.playClick()
    });
    this.table.init();

    this.zen = new ZenFlowHUD(zenEl, {
      onSolveAC: () => {
        this.fetchUserState();
        this.table.fetchProblems();
        this.updateWorkspaceTabUI();
        this.updateActiveSessionDock();
      },
      onGiveUp: () => {
        this.fetchUserState();
        this.table.fetchProblems();
        this.updateWorkspaceTabUI();
        this.updateActiveSessionDock();
      },
      onProblemChange: (prob) => {
        this.updateWorkspaceTabUI();
        this.updateActiveSessionDock();
        if (prob && prob.id && !this._isRouting) {
          const targetHash = buildRouteHash({ view: 'zen', problemId: prob.id });
          if (window.location.hash !== targetHash) {
            this.navHistoryDepth += 1;
            window.history.pushState({ depth: this.navHistoryDepth }, '', targetHash);
          }
          this.switchViewDOM('zen');
        }
      },
      onTimerTick: () => {
        this.updateActiveSessionDock();
      },
      onExit: (target) => this.handleBackFromZen(target)
    });

    this.techTree = new TechTreeVisualizer(treeEl, {
      onViewModeChange: (mode) => {
        if (!this._isRouting) {
          this.navigateTo(buildRouteHash({ view: 'techtree', subView: mode }));
        }
      },
      onNodeClick: (node) => {
        this.table.filterByCategory(node.category);
        this.navigateTo(buildRouteHash({
          view: 'table',
          category: node.category,
          contest: this.table.contestFilter
        }));
        this.showToast(`Filtered practice table to category: ${node.category}`);
      },
      onDomainDrill: (domainKey) => {
        flowStore.setDomainFilter(domainKey);
        this.startFlowSession('flow', { domainFilter: domainKey });
      },
      onDomainTable: (domainKey) => {
        this.table.filterByDomain(domainKey);
        this.navigateTo(buildRouteHash({
          view: 'table',
          domain: domainKey,
          contest: this.table.contestFilter
        }));
        const domObj = CORE_DOMAINS.find(d => d.key === domainKey);
        const name = domObj ? domObj.name : domainKey;
        this.showToast(`Filtered practice table to domain: ${name}`);
      },
      onAudioClick: () => audioEngine.playClick()
    });
    this.techTree.init();
  }

  toggleShortcutsModal() {
    audioEngine.playClick();
    const modal = document.getElementById('shortcuts-modal-overlay');
    if (!modal) return;
    const isVisible = modal.style.display !== 'none';
    modal.style.display = isVisible ? 'none' : 'flex';
  }

  attachGlobalKeynav() {
    window.addEventListener('keydown', (e) => {
      const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const key = e.key;

      // Global '?' shortcut modal toggle
      if (key === '?') {
        e.preventDefault();
        this.toggleShortcutsModal();
        return;
      }

      const shortcutsModal = document.getElementById('shortcuts-modal-overlay');
      if (shortcutsModal && shortcutsModal.style.display !== 'none') {
        if (key === 'Escape') {
          e.preventDefault();
          this.toggleShortcutsModal();
        }
        return;
      }

      // When in Zen Mode, delegate to ZenFlowHUD
      if (this.currentView === 'zen') {
        this.zen.handleKeyDown(e);
        return;
      }

      // In Table / Tech Tree View
      if (key === 'j') {
        e.preventDefault();
        this.table.moveDown();
      } else if (key === 'k') {
        e.preventDefault();
        this.table.moveUp();
      } else if (key === 'Enter') {
        e.preventDefault();
        audioEngine.playClick();
        this.table.activateSelected();
      } else if (key === 'g') {
        e.preventDefault();
        this.startGauntletSession();
      } else if (key === 'f') {
        e.preventDefault();
        this.startFlowSession('flow');
      } else if (key === '1') {
        e.preventDefault();
        this.startFlowSession('speed');
      } else if (key === '2') {
        e.preventDefault();
        this.startFlowSession('flow');
      } else if (key === '3') {
        e.preventDefault();
        this.startFlowSession('reach');
      } else if (key === 'u') {
        e.preventDefault();
        this.promptChangeHandle();
      } else if (key === 'v') {
        e.preventDefault();
        this.syncKenkoooo();
      } else if (key === 'm') {
        e.preventDefault();
        this.toggleMute();
      }
    });
  }

  attachHeaderEvents() {
    // Handle pill click
    const handlePill = document.getElementById('hud-handle-pill');
    if (handlePill) {
      handlePill.addEventListener('click', () => this.promptChangeHandle());
    }

    // Tabs
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        audioEngine.playClick();
        const view = tab.dataset.view;
        if (view === 'table') {
          this.navigateTo(buildRouteHash({
            view: 'table',
            domain: this.table.domainFilter,
            category: this.table.categoryFilter,
            contest: this.table.contestFilter
          }));
        } else if (view === 'techtree') {
          this.navigateTo(buildRouteHash({
            view: 'techtree',
            subView: this.techTree.viewMode || 'domains'
          }));
        } else if (view === 'zen') {
          const activeProb = this.zen.currentProblem || this.getSavedZenProblem();
          if (activeProb) {
            this.openZenMode(activeProb);
          } else {
            this.startFlowSession('flow');
          }
        }
      });
    });

    // Gauntlet session button
    const btnGauntlet = document.getElementById('btn-gauntlet-session');
    if (btnGauntlet) {
      btnGauntlet.addEventListener('click', () => this.startGauntletSession());
    }

    // Flow session button
    const btnFlow = document.getElementById('btn-flow-session');
    if (btnFlow) {
      btnFlow.addEventListener('click', () => this.startFlowSession('flow'));
    }

    // Kenkoooo Sync
    const btnSync = document.getElementById('btn-sync-kenkoooo');
    if (btnSync) {
      btnSync.addEventListener('click', () => this.syncKenkoooo());
    }

    // Mute
    const btnMute = document.getElementById('btn-toggle-mute');
    if (btnMute) {
      btnMute.addEventListener('click', () => this.toggleMute());
    }

    // Shortcuts Modal
    const btnShortcuts = document.getElementById('btn-shortcuts-modal');
    if (btnShortcuts) {
      btnShortcuts.addEventListener('click', () => this.toggleShortcutsModal());
    }
    const btnCloseShortcuts = document.getElementById('btn-close-shortcuts');
    if (btnCloseShortcuts) {
      btnCloseShortcuts.addEventListener('click', () => this.toggleShortcutsModal());
    }
    const shortcutsOverlay = document.getElementById('shortcuts-modal-overlay');
    if (shortcutsOverlay) {
      shortcutsOverlay.addEventListener('click', (e) => {
        if (e.target === shortcutsOverlay) this.toggleShortcutsModal();
      });
    }
  }

  /**
   * Prompts user to change their active AtCoder handle and recalibrates state.
   */
  async promptChangeHandle() {
    audioEngine.playClick();
    const currentHandle = this.userState?.handle || 'atrv';
    const newHandle = prompt('Enter your AtCoder handle:', currentHandle);
    if (!newHandle || !newHandle.trim() || newHandle.trim() === currentHandle) return;

    const cleanHandle = newHandle.trim();
    try {
      this.userState = flowStore.setHandle(cleanHandle);
      this.updateHudDOM();
      this.showToast(`Active handle switched to ${cleanHandle}. Syncing AtCoder history...`);
      await this.syncKenkoooo();
    } catch (err) {
      this.showToast(`Error switching handle: ${err.message}`);
    }
  }

  /**
   * Launches 3-problem structured Gauntlet session.
   */
  startGauntletSession() {
    audioEngine.playChime();
    this.zen.startGauntletRun();
  }

  /**
   * Automatically picks the next problem in the flow channel and launches Zen Mode with reel spin.
   */
  async startFlowSession(mode = 'flow', options = {}) {
    audioEngine.playClick();
    const offset = flowStore.getDiffOffset();
    const contest = flowStore.getContestFilter().toUpperCase();
    const bumpStr = offset !== 0 ? ` · Bump: ${offset > 0 ? '+' : ''}${offset}` : '';
    const domainFilter = (options.domainFilter !== undefined) ? options.domainFilter : flowStore.getDomainFilter();
    const domainStr = domainFilter ? ` · ${domainFilter.replace(/_/g, ' ').toUpperCase()}` : '';
    this.showToast(`Pulling ${mode.toUpperCase()} challenge reel [${contest}${bumpStr}${domainStr}]...`);
    try {
      const problem = flowStore.getNextFlowProblem(mode, options);
      if (problem) {
        this.openZenMode(problem);
      } else {
        this.showToast('Could not fetch next problem. Check practice table.', 'error');
      }
    } catch (err) {
      this.showToast(`Error: ${err.message}`, 'error');
    }
  }

  initRouter() {
    window.addEventListener('popstate', () => this.syncRouteFromUrl());
    window.addEventListener('hashchange', () => this.syncRouteFromUrl());

    if (!window.location.hash || window.location.hash === '#') {
      window.history.replaceState({ depth: 0 }, '', '#/table');
    }

    // Hydrate saved problem into Zen controller in background if we aren't on #/problem
    const savedProb = this.getSavedZenProblem();
    if (savedProb && !this.zen.currentProblem) {
      this.zen.currentProblem = savedProb;
    }

    this.syncRouteFromUrl();
    this.updateWorkspaceTabUI();
    this.updateActiveSessionDock();
  }

  navigateTo(routeOrHash, replace = false) {
    const targetHash = typeof routeOrHash === 'object' ? buildRouteHash(routeOrHash) : routeOrHash;
    if (window.location.hash === targetHash && !replace) {
      this.syncRouteFromUrl();
      return;
    }

    if (replace) {
      window.history.replaceState({ depth: this.navHistoryDepth }, '', targetHash);
    } else {
      this.navHistoryDepth += 1;
      window.history.pushState({ depth: this.navHistoryDepth }, '', targetHash);
    }

    this.syncRouteFromUrl();
  }

  syncRouteFromUrl() {
    if (this._isRouting) return;
    this._isRouting = true;

    try {
      const route = parseRouteHash(window.location.hash);

      if (route.view === 'table') {
        this.table.setFiltersFromRoute({
          domain: route.domain,
          category: route.category,
          contest: route.contest
        });
        this.switchViewDOM('table');
      } else if (route.view === 'techtree') {
        this.switchViewDOM('techtree');
        this.techTree.setViewModeFromRoute(route.subView || 'domains');
      } else if (route.view === 'zen') {
        let prob = route.problemId ? flowStore.getProblem(route.problemId) : this.zen.currentProblem;
        if (!prob) {
          prob = this.getSavedZenProblem();
        }
        if (prob) {
          this.switchViewDOM('zen');
          if (!this.zen.currentProblem || this.zen.currentProblem.id !== prob.id || !this.zen.container.innerHTML) {
            this.zen.loadProblem(prob, true);
          }
        } else {
          window.history.replaceState({ depth: this.navHistoryDepth }, '', '#/table');
          this.switchViewDOM('table');
        }
      }

      this.updateWorkspaceTabUI();
      this.updateActiveSessionDock();
    } finally {
      this._isRouting = false;
    }
  }

  handleBackFromZen(target = 'back') {
    if (target === 'table') {
      this.navigateTo(buildRouteHash({
        view: 'table',
        domain: this.table.domainFilter,
        category: this.table.categoryFilter,
        contest: this.table.contestFilter
      }));
      return;
    }

    if (this.navHistoryDepth > 0) {
      this.navHistoryDepth = Math.max(0, this.navHistoryDepth - 1);
      window.history.back();
    } else {
      this.navigateTo('#/table');
    }
  }

  switchViewDOM(viewName) {
    this.currentView = viewName;

    const tableSec = document.getElementById('view-table-section');
    const treeSec = document.getElementById('view-techtree-section');
    const zenSec = document.getElementById('view-zen-section');

    if (tableSec) tableSec.style.display = viewName === 'table' ? 'block' : 'none';
    if (treeSec) treeSec.style.display = viewName === 'techtree' ? 'block' : 'none';
    if (zenSec) zenSec.style.display = viewName === 'zen' ? 'block' : 'none';

    document.querySelectorAll('.tab-btn').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.view === viewName);
    });

    if (viewName === 'techtree') {
      this.techTree.fetchTechTree();
    }

    this.updateActiveSessionDock();
  }

  switchView(viewName) {
    if (viewName === 'table') {
      this.navigateTo('#/table');
    } else if (viewName === 'techtree') {
      this.navigateTo(buildRouteHash({ view: 'techtree', subView: this.techTree.viewMode || 'domains' }));
    } else if (viewName === 'zen') {
      const prob = this.zen.currentProblem || this.getSavedZenProblem();
      if (prob) {
        this.openZenMode(prob);
      }
    }
  }

  openZenMode(problem) {
    if (!problem) return;
    if (this.zen.currentProblem && this.zen.currentProblem.id === problem.id && this.zen.container.innerHTML) {
      this.navigateTo(buildRouteHash({ view: 'zen', problemId: problem.id }));
    } else {
      this.zen.loadProblem(problem);
    }
  }

  getSavedZenProblem() {
    try {
      const saved = localStorage.getItem('atcoder_flow_zen_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.problem_id) {
          const prob = flowStore.getProblem(parsed.problem_id);
          if (prob && !prob.is_solved) {
            return prob;
          }
        }
      }
    } catch (_) {}
    return null;
  }

  updateWorkspaceTabUI() {
    const zenTab = document.getElementById('tab-zen-btn');
    if (!zenTab) return;

    const activeProb = this.zen?.currentProblem || this.getSavedZenProblem();
    if (activeProb && activeProb.id) {
      zenTab.textContent = `⚡ WORKSPACE [${activeProb.id.toUpperCase()}]`;
      zenTab.title = `Resume active problem: ${activeProb.title || activeProb.id}`;
    } else {
      zenTab.textContent = '⚡ FLOW WORKSPACE';
      zenTab.title = 'Launch or resume Flow problem workspace';
    }
  }

  /**
   * Renders / updates the persistent bottom Mini-Dock when viewing Table or Tech Tree with an active problem.
   */
  updateActiveSessionDock() {
    const dock = document.getElementById('active-session-dock');
    if (!dock) return;

    const activeProb = this.zen?.currentProblem || this.getSavedZenProblem();
    if (!activeProb || this.currentView === 'zen') {
      dock.style.display = 'none';
      return;
    }

    dock.style.display = 'flex';
    const timeStr = this.zen.formatTime(this.zen.elapsedSeconds || 0);
    const isPaused = Boolean(this.zen.isPaused);
    const contest = (activeProb.contest_id || '').toUpperCase();
    const diff = activeProb.clipped_difficulty || 'N/A';

    // If dock already mounted for this problem, just update live text to avoid killing button clicks
    if (dock.dataset.probId === activeProb.id) {
      const clockEl = dock.querySelector('#dock-clock-val');
      const statusEl = dock.querySelector('#dock-status-pill');
      const pauseBtn = dock.querySelector('#btn-dock-pause');
      if (clockEl) clockEl.textContent = timeStr;
      if (statusEl) {
        statusEl.textContent = isPaused ? '❚❚ PAUSED' : '● ACTIVE SESSION';
        statusEl.className = `dock-status-pill ${isPaused ? 'paused' : 'running'}`;
      }
      if (pauseBtn) pauseBtn.textContent = isPaused ? '▶ Resume' : '⏸ Pause';
      return;
    }

    dock.dataset.probId = activeProb.id;
    dock.innerHTML = `
      <div class="dock-left">
        <span id="dock-status-pill" class="dock-status-pill ${isPaused ? 'paused' : 'running'}">
          ${isPaused ? '❚❚ PAUSED' : '● ACTIVE SESSION'}
        </span>
        <span class="dock-problem-title">
          <strong>${contest}</strong> // ${activeProb.title || activeProb.id}
        </span>
        <span class="dock-diff-badge">DIFF ${diff}</span>
      </div>
      <div class="dock-right">
        <span id="dock-clock-val" class="dock-clock">${timeStr}</span>
        <button id="btn-dock-pause" class="btn-timer-ctrl" title="Pause / Resume Stopwatch">
          ${isPaused ? '▶ Resume' : '⏸ Pause'}
        </button>
        <button id="btn-dock-reset" class="btn-timer-ctrl btn-timer-reset" title="Reset Stopwatch to 00:00">
          ↺ Reset
        </button>
        <button id="btn-dock-resume" class="btn-dock-open" title="Return to Problem Workbench">
          ⚡ Open Workspace →
        </button>
        <button id="btn-dock-close" class="btn-dock-end" title="End and clear active problem session [w]">
          ⏹ End Session
        </button>
      </div>
    `;

    dock.querySelector('#btn-dock-pause')?.addEventListener('click', () => {
      if (!this.zen.timerInterval && this.zen.isPaused) {
        this.zen.startTimer();
      }
      this.zen.togglePause();
    });
    dock.querySelector('#btn-dock-reset')?.addEventListener('click', () => {
      this.zen.resetTimer();
    });
    dock.querySelector('#btn-dock-resume')?.addEventListener('click', () => {
      audioEngine.playClick();
      this.openZenMode(activeProb);
    });
    dock.querySelector('#btn-dock-close')?.addEventListener('click', () => {
      audioEngine.playClick();
      dock.dataset.probId = '';
      this.zen.endSession();
      this.showToast('Practice session ended.');
    });
  }

  toggleMute() {
    const isMuted = audioEngine.toggleMute();
    const btnMute = document.getElementById('btn-toggle-mute');
    const audioLabel = document.getElementById('btn-audio-label');
    if (btnMute) {
      btnMute.classList.toggle('active', isMuted);
    }
    if (audioLabel) {
      audioLabel.textContent = isMuted ? '[m] AUDIO: OFF' : '[m] AUDIO: ON';
    }
    this.showToast(isMuted ? 'Sound Muted' : 'Sound Enabled');
    this.saveUserPreferences({ muted: isMuted });
  }

  async syncKenkoooo() {
    const btnSync = document.getElementById('btn-sync-kenkoooo');
    if (btnSync) btnSync.disabled = true;
    this.showToast('Syncing with Kenkoooo API...');

    try {
      const data = await flowStore.syncKenkoooo();
      if (data.new_ac && data.new_ac.length > 0) {
        audioEngine.playChime();
        this.showToast(`Sync successful! ${data.new_ac.length} new AC solves recorded.`, 'ac-toast');
      } else {
        this.showToast(`Sync complete (${data.synced || 0} total AC submissions cached).`);
      }
      this.fetchUserState();
      this.table.renderTable();
    } catch (err) {
      this.showToast(`Sync failed: ${err.message}`);
    } finally {
      if (btnSync) btnSync.disabled = false;
    }
  }

  async fetchUserState() {
    try {
      this.userState = flowStore.getUserState();
      this.updateHudDOM();
    } catch (_) {}
  }

  updateHudDOM() {
    const handleEl = document.getElementById('hud-handle-val');
    const streakEl = document.getElementById('hud-streak-val');
    const ratingEl = document.getElementById('hud-rating-val');
    const cfEl = document.getElementById('hud-cf-val');
    const solvedEl = document.getElementById('hud-solved-val');
    const syncLabel = document.getElementById('btn-sync-label');

    if (handleEl && this.userState.handle) {
      handleEl.textContent = this.userState.handle;
    }
    if (syncLabel && this.userState.handle) {
      syncLabel.textContent = `[v] SYNC ${this.userState.handle.toUpperCase()}`;
    }
    if (streakEl) streakEl.textContent = this.userState.streak ?? 0;
    
    const tr = this.userState.training_rating ?? 1200;
    const atMeta = getAtcoderMeta(tr);
    const cfMeta = atcoderToCodeforces(tr);

    if (ratingEl) {
      ratingEl.textContent = Math.round(tr);
      ratingEl.style.color = atMeta.color;
    }
    if (cfEl) {
      cfEl.textContent = `[CF ${cfMeta.cfRating} ${cfMeta.title}]`;
      cfEl.style.color = cfMeta.color;
    }
    if (solvedEl) solvedEl.textContent = `${this.userState.solved_count ?? 0} AC`;
  }

  async fetchUserPreferences() {
    try {
      const prefs = flowStore.getUserPreferences();
      if (typeof prefs.hide_difficulty === 'boolean') {
        this.table.setHideDifficulty(prefs.hide_difficulty);
      }
      if (typeof prefs.muted === 'boolean' && prefs.muted) {
        this.toggleMute();
      }
    } catch (_) {}
  }

  async saveUserPreferences(prefs) {
    try {
      flowStore.saveUserPreferences(prefs);
    } catch (_) {}
  }

  showToast(msg, className = '') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${className}`;
    toast.textContent = msg;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new AtCoderFlowApp();
  app.init();
  window.__atcoderApp = app;
});
