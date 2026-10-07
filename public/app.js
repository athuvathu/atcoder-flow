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
          <div class="metric-pill rating editable-rating-badge" id="hud-rating-pill" style="cursor:pointer;" title="Click to manually edit Practice Rating, Auto-Calibrate from Solved History, or view Telemetry">
            <span>RATING:</span>
            <strong id="hud-rating-val" style="color:var(--accent-cyan)">1200</strong>
            <span class="rating-edit-glyph">✎</span>
            <span id="hud-cf-val" class="hud-cf-badge" style="color:#4a90e2; margin-left:4px;">[CF 1680 Expert]</span>
          </div>
          <div class="metric-pill solved" id="hud-solved-pill" style="cursor:pointer;" title="Click to view Telemetry, Domain Mastery & State Backup">
            <span>SOLVED:</span>
            <strong id="hud-solved-val">0 AC</strong>
          </div>
        </div>

        <div class="header-actions">
          <button id="btn-cmd-palette" class="btn-icon btn-cmd-trigger" title="Universal Command Palette: Search 954 problems, jump rating, or run actions [Ctrl+K or /]">
            <span>[Ctrl+K] ⌘ SEARCH</span>
          </button>
          <button id="btn-cards-gallery" class="btn-icon" title="Open SFW Anime Artwork Reward Card Vault [i]">
            <span id="btn-cards-label">[i] 🃏 VAULT (0)</span>
          </button>
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

      <!-- Rating Calibrator, Frontier Settings & Telemetry Modal -->
      <div id="rating-telemetry-overlay" class="shortcuts-modal-overlay" style="display:none;">
        <div class="shortcuts-modal-card rating-telemetry-card" id="rating-telemetry-body"></div>
      </div>

      <!-- Anime Artwork Reward Card Vault Modal -->
      <div id="cards-gallery-overlay" class="shortcuts-modal-overlay" style="display:none;">
        <div class="shortcuts-modal-card rating-telemetry-card cards-vault-modal-card" id="cards-gallery-body"></div>
      </div>

      <!-- Full-Window / Fullscreen Card Lightbox Overlay -->
      <div id="card-lightbox-overlay" class="card-lightbox-overlay" style="display:none;"></div>

      <!-- Universal Command Palette (Ctrl+K / /) -->
      <div id="cmd-palette-overlay" class="cmd-palette-overlay" style="display:none;">
        <div class="cmd-palette-card">
          <div class="cmd-palette-input-wrap">
            <span class="cmd-palette-prompt">⌘</span>
            <input type="text" id="cmd-palette-input" class="cmd-palette-input" placeholder="Type a rating (e.g. 1600), problem ID/title, domain, or command..." autocomplete="off" />
            <kbd class="cmd-palette-esc">ESC</kbd>
          </div>
          <div id="cmd-palette-results" class="cmd-palette-results"></div>
        </div>
      </div>

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
              <div class="shortcut-row"><kbd>Ctrl+K</kbd> / <kbd>/</kbd> <span>Command Palette (Search / Set Rating)</span></div>
              <div class="shortcut-row"><kbd>j</kbd> / <kbd>k</kbd> <span>Move selection Down / Up in Table</span></div>
              <div class="shortcut-row"><kbd>Enter</kbd> <span>Open selected problem in Workbench</span></div>
              <div class="shortcut-row"><kbd>f</kbd> <span>Pull instant Flow problem (at your Par rating)</span></div>
              <div class="shortcut-row"><kbd>1</kbd>/<kbd>2</kbd>/<kbd>3</kbd>/<kbd>4</kbd> <span>Pull Speed / Flow / Reach / ⚑ Review</span></div>
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
              <div class="shortcut-row"><kbd>b</kbd> <span>Bookmark / Unbookmark problem for ⚑ Review</span></div>
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
      onOpenRatingModal: () => this.openRatingModal(),
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
      // Full-Window Card Lightbox takes highest priority when open
      const lightboxOverlay = document.getElementById('card-lightbox-overlay');
      if (lightboxOverlay && lightboxOverlay.style.display !== 'none') {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.closeCardLightbox();
        } else if (e.key === ' ') {
          e.preventDefault();
          this.toggleSlideshowPlayPause();
        } else if (e.key === 'ArrowRight' || e.key === 'j') {
          e.preventDefault();
          if (this.slideshowActive && this.slideshowMode === 'stream') {
            this.advanceSlideshowSlide(true);
          } else {
            this.stepLightboxCard(1);
          }
        } else if (e.key === 'ArrowLeft' || e.key === 'k') {
          e.preventDefault();
          this.stepLightboxCard(-1);
        } else if (e.key === '+' || e.key === '=' || e.key === ']') {
          e.preventDefault();
          this.adjustSlideshowInterval(1);
        } else if (e.key === '-' || e.key === '_' || e.key === '[') {
          e.preventDefault();
          this.adjustSlideshowInterval(-1);
        } else if (e.key.toLowerCase() === 'f') {
          e.preventDefault();
          this.toggleNativeFullscreen(lightboxOverlay);
        }
        return;
      }

      // Global Ctrl+K / Cmd+K Command Palette trigger (works everywhere)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.toggleCommandPalette();
        return;
      }

      const cmdOverlay = document.getElementById('cmd-palette-overlay');
      if (cmdOverlay && cmdOverlay.style.display !== 'none') {
        this.handleCommandPaletteKey(e);
        return;
      }

      const ratingOverlay = document.getElementById('rating-telemetry-overlay');
      if (ratingOverlay && ratingOverlay.style.display !== 'none') {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.closeRatingModal();
        }
        return;
      }

      const cardsOverlay = document.getElementById('cards-gallery-overlay');
      if (cardsOverlay && cardsOverlay.style.display !== 'none') {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.closeCardsGalleryModal();
        }
        return;
      }

      const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const key = e.key;

      // '/' opens Command Palette when not typing in an input
      if (key === '/') {
        e.preventDefault();
        this.openCommandPalette();
        return;
      }

      // 'i' opens SFW Anime Artwork Card Vault
      if (key === 'i') {
        e.preventDefault();
        this.openCardsGalleryModal();
        return;
      }

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
      } else if (key === '4') {
        e.preventDefault();
        this.startFlowSession('review');
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

    // Editable Rating pill & Solved pill click -> open Rating Calibrator & Telemetry Modal
    const ratingPill = document.getElementById('hud-rating-pill');
    if (ratingPill) {
      ratingPill.addEventListener('click', () => this.openRatingModal());
    }
    const solvedPill = document.getElementById('hud-solved-pill');
    if (solvedPill) {
      solvedPill.addEventListener('click', () => this.openRatingModal());
    }

    // Card Vault button & overlay click
    const btnCards = document.getElementById('btn-cards-gallery');
    if (btnCards) {
      btnCards.addEventListener('click', () => this.openCardsGalleryModal());
    }
    const cardsOverlay = document.getElementById('cards-gallery-overlay');
    if (cardsOverlay) {
      cardsOverlay.addEventListener('click', (e) => {
        if (e.target === cardsOverlay) this.closeCardsGalleryModal();
      });
    }

    // Command Palette button & overlay click
    const btnCmd = document.getElementById('btn-cmd-palette');
    if (btnCmd) {
      btnCmd.addEventListener('click', () => this.openCommandPalette());
    }
    const cmdOverlay = document.getElementById('cmd-palette-overlay');
    if (cmdOverlay) {
      cmdOverlay.addEventListener('click', (e) => {
        if (e.target === cmdOverlay) this.closeCommandPalette();
      });
    }
    const cmdInput = document.getElementById('cmd-palette-input');
    if (cmdInput) {
      cmdInput.addEventListener('input', () => {
        this.cmdSelectedIndex = 0;
        this.renderCommandPaletteResults(cmdInput.value);
      });
    }

    const ratingOverlay = document.getElementById('rating-telemetry-overlay');
    if (ratingOverlay) {
      ratingOverlay.addEventListener('click', (e) => {
        if (e.target === ratingOverlay) this.closeRatingModal();
      });
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
    const cardsLabel = document.getElementById('btn-cards-label');
    if (cardsLabel) {
      const count = flowStore.getCardCollection().length;
      cardsLabel.textContent = `[i] 🃏 VAULT (${count})`;
    }
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

  /**
   * Opens the SFW Anime Artwork Reward Card Vault Modal.
   */
  openCardsGalleryModal() {
    audioEngine.playClick();
    const overlay = document.getElementById('cards-gallery-overlay');
    if (!overlay) return;
    this.renderCardsGalleryContent();
    overlay.style.display = 'flex';
  }

  closeCardsGalleryModal() {
    const overlay = document.getElementById('cards-gallery-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  renderCardsGalleryContent() {
    const container = document.getElementById('cards-gallery-body');
    if (!container) return;

    const cards = flowStore.getCardCollection();
    const ssrCount = cards.filter(c => c.rarityTier === 'SSR').length;
    const srCount = cards.filter(c => c.rarityTier === 'SR').length;
    const intervalSec = this.getSlideshowIntervalSec();

    container.innerHTML = `
      <div class="shortcuts-modal-header">
        <div>
          <strong>🃏 ANIME ARTWORK REWARD VAULT (GACHA COLLECTION)</strong>
          <span class="shortcuts-sub">Click any artwork to view Full Window / Fullscreen · ${cards.length} collected (${ssrCount} SSR · ${srCount} SR)</span>
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <button id="btn-start-relax-slideshow" class="btn-slideshow-launch" title="Launch consecutive Full-Window Waifu Slideshow (${intervalSec}s adjustable)">▶ RELAX SLIDESHOW (${intervalSec}s)</button>
          <button id="btn-roll-gacha-now" class="btn-flow-launch" title="Roll a new Anime Artwork Card from Waifu.im right now">🎲 ROLL NEW CARD</button>
          ${cards.length > 0 ? `<button id="btn-clear-vault" class="btn-drawer-close" title="Clear all cards from Vault">🗑 CLEAR ALL</button>` : ''}
          <button id="btn-close-cards-modal" class="btn-drawer-close">[Esc] CLOSE</button>
        </div>
      </div>

      ${cards.length === 0 ? `
        <div class="cards-empty-state">
          <p>No reward cards unlocked yet. Every verified or attested <strong>AC Solve</strong> automatically drops a new Waifu.im Artwork Card!</p>
          <div style="display:flex; gap:10px; justify-content:center; margin-top:12px;">
            <button id="btn-roll-first-card" class="btn-zen-primary">🎲 Roll Your First Starter Card</button>
            <button id="btn-empty-relax-slideshow" class="btn-slideshow-launch">▶ Start Relax Slideshow (${intervalSec}s Stream)</button>
          </div>
        </div>
      ` : `
        <div class="cards-vault-grid">
          ${cards.map((c, idx) => `
            <div class="reward-vault-card" style="border-color:${c.rarityColor || '#262936'}66;">
              <div class="rvc-image-wrap" data-idx="${idx}" title="Click to open Full Window / Fullscreen">
                <img src="${c.imageUrl}" alt="${c.character || 'Anime Card'}" loading="lazy" class="rvc-img" />
                <span class="rvc-rarity-pill" style="color:${c.rarityColor}; border-color:${c.rarityColor};">${c.rarityTier || 'R'}</span>
                <span class="rvc-zoom-overlay">⛶ FULL WINDOW</span>
              </div>
              <div class="rvc-info">
                <div class="rvc-title" title="${c.character || ''}">${c.character || 'Anime Illustration'}</div>
                <div class="rvc-meta">Art: ${c.artist || 'Illustrator'} · <span style="color:var(--accent-cyan);">${(c.problemId || 'AC').toUpperCase()} (${Math.max(100, c.problemDiff || 1200)})</span></div>
                <div class="rvc-actions">
                  <div style="display:flex; gap:6px;">
                    <button type="button" class="btn-copy-sample btn-full-card" data-idx="${idx}">⛶ FULL WINDOW</button>
                    <a href="${c.fullUrl || c.imageUrl}" target="_blank" rel="noopener" class="btn-copy-sample">RAW ↗</a>
                  </div>
                  <button class="btn-copy-sample btn-del-card" data-id="${c.id}" title="Remove from Vault">✕</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    `;

    document.getElementById('btn-close-cards-modal')?.addEventListener('click', () => this.closeCardsGalleryModal());
    document.getElementById('btn-start-relax-slideshow')?.addEventListener('click', () => this.startRelaxSlideshow('stream'));
    document.getElementById('btn-empty-relax-slideshow')?.addEventListener('click', () => this.startRelaxSlideshow('stream'));
    document.getElementById('btn-clear-vault')?.addEventListener('click', () => {
      flowStore.clearRewardCards();
      this.updateHudDOM();
      this.renderCardsGalleryContent();
      this.showToast('Cleared all cards from Vault.');
    });

    const rollHandler = async (btn) => {
      if (!btn) return;
      btn.disabled = true;
      btn.textContent = '🎲 ROLLING...';
      try {
        const card = await flowStore.rollRewardCard(this.zen?.currentProblem || null, null);
        audioEngine.playChime();
        this.updateHudDOM();
        this.renderCardsGalleryContent();
        this.showToast(`Unlocked [${card.rarity}] ${card.character}!`, 'ac-toast');
      } catch (err) {
        this.showToast(`Roll failed: ${err.message}`, 'error');
        btn.disabled = false;
        btn.textContent = '🎲 ROLL NEW CARD';
      }
    };

    const btnRoll = document.getElementById('btn-roll-gacha-now');
    if (btnRoll) btnRoll.addEventListener('click', () => rollHandler(btnRoll));
    const btnFirst = document.getElementById('btn-roll-first-card');
    if (btnFirst) btnFirst.addEventListener('click', () => rollHandler(btnFirst));

    container.querySelectorAll('.rvc-image-wrap, .btn-full-card').forEach(el => {
      el.addEventListener('click', () => {
        const idx = Number(el.dataset.idx);
        const card = cards[idx];
        if (card) this.openCardLightbox(card, idx);
      });
    });

    container.querySelectorAll('.btn-del-card').forEach(btn => {
      btn.addEventListener('click', () => {
        flowStore.deleteRewardCard(btn.dataset.id);
        this.updateHudDOM();
        this.renderCardsGalleryContent();
      });
    });
  }

  getSlideshowIntervalSec() {
    const saved = Number(localStorage.getItem('flow_slideshow_sec'));
    return Number.isFinite(saved) && saved >= 1 && saved <= 120 ? saved : 4;
  }

  setSlideshowIntervalSec(sec) {
    const clamped = Math.max(1, Math.min(120, Math.round(Number(sec) || 4)));
    this.slideshowIntervalSec = clamped;
    localStorage.setItem('flow_slideshow_sec', String(clamped));
    if (this.slideshowActive) {
      this.scheduleNextSlide();
    }
    this.renderLightboxDOM();
    const galleryModal = document.getElementById('cards-modal-overlay');
    if (galleryModal && galleryModal.style.display !== 'none') {
      this.renderCardsGalleryContent();
    }
  }

  adjustSlideshowInterval(deltaSec) {
    const current = this.getSlideshowIntervalSec();
    this.setSlideshowIntervalSec(current + deltaSec);
    this.showToast(`Slideshow interval: ${this.getSlideshowIntervalSec()}s`);
  }

  /**
   * Launches the consecutive Waifu Relax Slideshow in Full-Window Lightbox mode.
   * Preloads upcoming images in a background queue so 4-second transitions are instant.
   */
  async startRelaxSlideshow(mode = 'stream') {
    audioEngine.playClick();
    this.slideshowMode = mode || localStorage.getItem('flow_slideshow_mode') || 'stream';
    localStorage.setItem('flow_slideshow_mode', this.slideshowMode);
    this.slideshowIntervalSec = this.getSlideshowIntervalSec();
    this.slideshowActive = true;
    this.slideshowPaused = false;
    this.slideshowPreloadQueue = this.slideshowPreloadQueue || [];

    const overlay = document.getElementById('card-lightbox-overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';

    // If no card is currently in lightbox, grab the first one immediately
    if (!this.lightboxCard) {
      const existing = flowStore.getCardCollection();
      if (existing.length > 0 && this.slideshowMode === 'vault') {
        this.lightboxIndex = 0;
        this.lightboxCard = existing[0];
      } else {
        overlay.innerHTML = `
          <div class="lightbox-stage">
            <div style="color:var(--accent-cyan); font-size:14px; font-weight:700;">✨ Pulling fresh Waifu.im stream...</div>
          </div>
        `;
        try {
          const firstCard = await this.pullPreloadedCardOrFetch();
          this.lightboxCard = firstCard;
          this.lightboxIndex = 0;
        } catch (err) {
          this.showToast(`Stream error: ${err.message}`, 'error');
          if (existing.length > 0) {
            this.lightboxCard = existing[0];
            this.lightboxIndex = 0;
          } else {
            this.closeCardLightbox();
            return;
          }
        }
      }
    }

    this.renderLightboxDOM();
    this.fillSlideshowPreloadQueue();
    this.scheduleNextSlide();
  }

  toggleSlideshowPlayPause() {
    audioEngine.playClick();
    if (!this.slideshowActive) {
      this.startRelaxSlideshow(this.slideshowMode || 'stream');
      return;
    }
    this.slideshowPaused = !this.slideshowPaused;
    if (this.slideshowPaused) {
      this.stopSlideshowTimer();
      this.showToast('⏸ Slideshow paused [Space to resume]');
    } else {
      this.fillSlideshowPreloadQueue();
      this.scheduleNextSlide();
      this.showToast(`▶ Slideshow resumed (${this.getSlideshowIntervalSec()}s)`);
    }
    this.renderLightboxDOM();
  }

  toggleSlideshowSourceMode() {
    audioEngine.playClick();
    this.slideshowMode = this.slideshowMode === 'vault' ? 'stream' : 'vault';
    localStorage.setItem('flow_slideshow_mode', this.slideshowMode);
    if (this.slideshowMode === 'stream') {
      this.fillSlideshowPreloadQueue();
    }
    this.renderLightboxDOM();
    this.showToast(this.slideshowMode === 'stream' ? '🌐 Streaming consecutive NEW Waifu.im cards' : '🃏 Cycling saved Vault cards');
  }

  async pullPreloadedCardOrFetch() {
    if (this.slideshowPreloadQueue && this.slideshowPreloadQueue.length > 0) {
      const next = this.slideshowPreloadQueue.shift();
      this.fillSlideshowPreloadQueue();
      return next;
    }
    const card = await flowStore.rollRewardCard(this.zen?.currentProblem || null, null);
    await this.preloadImageUrl(card.fullUrl || card.imageUrl);
    this.updateHudDOM();
    const galleryModal = document.getElementById('cards-modal-overlay');
    if (galleryModal && galleryModal.style.display !== 'none') {
      this.renderCardsGalleryContent();
    }
    return card;
  }

  preloadImageUrl(url) {
    return new Promise((resolve) => {
      if (!url) return resolve();
      const img = new Image();
      let settled = false;
      const done = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      img.onload = done;
      img.onerror = done;
      setTimeout(done, 6500);
      img.src = url;
    });
  }

  async fillSlideshowPreloadQueue() {
    if (this.slideshowPreloading) return;
    if (!this.slideshowActive || this.slideshowPaused || this.slideshowMode !== 'stream') return;
    this.slideshowPreloading = true;
    try {
      this.slideshowPreloadQueue = this.slideshowPreloadQueue || [];
      while (this.slideshowActive && !this.slideshowPaused && this.slideshowMode === 'stream' && this.slideshowPreloadQueue.length < 2) {
        const card = await flowStore.rollRewardCard(this.zen?.currentProblem || null, null);
        await this.preloadImageUrl(card.fullUrl || card.imageUrl);
        this.slideshowPreloadQueue.push(card);
        this.updateHudDOM();
      }
    } catch (_) {
      // Silently retry on next tick if network hiccups
    } finally {
      this.slideshowPreloading = false;
    }
  }

  stopSlideshowTimer() {
    if (this.slideshowTimer) {
      clearTimeout(this.slideshowTimer);
      this.slideshowTimer = null;
    }
  }

  scheduleNextSlide() {
    this.stopSlideshowTimer();
    if (!this.slideshowActive || this.slideshowPaused) return;
    const durationMs = this.getSlideshowIntervalSec() * 1000;

    // Reset CSS progress bar animation smoothly
    const bar = document.getElementById('lightbox-progress-bar');
    if (bar) {
      bar.style.transition = 'none';
      bar.style.width = '0%';
      void bar.offsetWidth; // force reflow
      bar.style.transition = `width ${durationMs}ms linear`;
      bar.style.width = '100%';
    }

    this.slideshowTimer = setTimeout(() => {
      this.advanceSlideshowSlide(false);
    }, durationMs);
  }

  async advanceSlideshowSlide(manualTrigger = false) {
    this.stopSlideshowTimer();
    if (!this.slideshowActive && !manualTrigger) return;

    const mode = this.slideshowMode || 'stream';
    if (mode === 'vault') {
      this.stepLightboxCard(1, true);
      if (this.slideshowActive && !this.slideshowPaused) {
        this.scheduleNextSlide();
      }
      return;
    }

    // Stream new Waifu.im card
    try {
      const statusBadge = document.getElementById('lb-stream-status');
      if (statusBadge && (!this.slideshowPreloadQueue || this.slideshowPreloadQueue.length === 0)) {
        statusBadge.textContent = '⏳ LOADING NEXT...';
      }
      const nextCard = await this.pullPreloadedCardOrFetch();
      if (!this.slideshowActive && !manualTrigger) return;
      this.lightboxCard = nextCard;
      this.lightboxIndex = 0;
      const galleryModal = document.getElementById('cards-modal-overlay');
      if (galleryModal && galleryModal.style.display !== 'none') {
        this.renderCardsGalleryContent();
      }
      this.renderLightboxDOM();
    } catch (err) {
      this.showToast(`Slideshow fetch retry: ${err.message}`, 'error');
    }

    if (this.slideshowActive && !this.slideshowPaused) {
      this.scheduleNextSlide();
      this.fillSlideshowPreloadQueue();
    }
  }

  /**
   * Opens a Full-Window / Fullscreen Lightbox for inspecting an artwork card at maximum resolution.
   */
  openCardLightbox(card, indexHint = null) {
    audioEngine.playClick();
    const overlay = document.getElementById('card-lightbox-overlay');
    if (!overlay || !card) return;

    const cards = flowStore.getCardCollection();
    const foundIdx = indexHint !== null ? indexHint : cards.findIndex(c => c.id === card.id);
    this.lightboxIndex = foundIdx >= 0 ? foundIdx : 0;
    this.lightboxCard = card;

    overlay.style.display = 'flex';
    this.renderLightboxDOM();
  }

  renderLightboxDOM() {
    const overlay = document.getElementById('card-lightbox-overlay');
    if (!overlay || !this.lightboxCard) return;

    const cards = flowStore.getCardCollection();
    const c = this.lightboxCard;
    const total = cards.length;
    const posStr = total > 0 ? `${this.lightboxIndex + 1} / ${total}` : '1 / 1';
    const intervalSec = this.getSlideshowIntervalSec();
    const isRunning = this.slideshowActive && !this.slideshowPaused;
    const mode = this.slideshowMode || localStorage.getItem('flow_slideshow_mode') || 'stream';
    const presets = [2, 3, 4, 6, 10];

    overlay.innerHTML = `
      <div class="lightbox-progress-track">
        <div id="lightbox-progress-bar" class="lightbox-progress-bar" style="width:${isRunning ? '100%' : '0%'};"></div>
      </div>
      <div class="lightbox-top-hud">
        <div class="lightbox-meta-left">
          <span class="lightbox-rarity-badge" style="color:${c.rarityColor || '#00e5ff'}; border-color:${c.rarityColor || '#00e5ff'};">${c.rarity || 'R'}</span>
          <strong class="lightbox-title">${c.character || 'Anime Illustration'}</strong>
          <span class="lightbox-sub">Art by ${c.artist || 'Illustrator'} · [${posStr}]</span>
          ${this.slideshowActive ? `<span id="lb-stream-status" class="lb-stream-badge">${this.slideshowPaused ? '⏸ PAUSED' : `● LIVE ${intervalSec}s`}</span>` : ''}
        </div>
        <div class="lightbox-actions-right">
          <div class="slideshow-controls-pill">
            <button type="button" id="btn-lb-slideshow-toggle" class="${isRunning ? 'btn-slideshow-active' : 'btn-slideshow-launch'}" title="Toggle Relax Slideshow [Space]">
              ${isRunning ? '⏸ PAUSE [Space]' : (this.slideshowActive && this.slideshowPaused ? '▶ RESUME [Space]' : '▶ RELAX SLIDESHOW')}
            </button>
            <button type="button" id="btn-lb-slideshow-mode" class="btn-drawer-close" title="Switch between streaming new Waifu.im cards vs cycling saved Vault">
              ${mode === 'stream' ? '🌐 NEW STREAM' : '🃏 VAULT'}
            </button>
            <div class="slideshow-interval-group" title="Slideshow Interval (seconds) [- / + keys]">
              <button type="button" id="btn-lb-sec-dec" class="btn-sec-step">−</button>
              ${presets.map(s => `
                <button type="button" class="btn-sec-preset ${intervalSec === s ? 'active' : ''}" data-sec="${s}">${s}s</button>
              `).join('')}
              ${!presets.includes(intervalSec) ? `<span class="btn-sec-preset active">${intervalSec}s</span>` : ''}
              <button type="button" id="btn-lb-sec-inc" class="btn-sec-step">+</button>
            </div>
          </div>
          <button type="button" id="btn-lb-prev" class="btn-drawer-close" title="Previous Card [← or k]">←</button>
          <button type="button" id="btn-lb-next" class="btn-drawer-close" title="Next / Pull New [→ or j]">→</button>
          <button type="button" id="btn-lb-native-fs" class="btn-flow-launch" title="Toggle 100% Monitor Fullscreen [f]">⛶ [f] FULLSCREEN</button>
          <a href="${c.fullUrl || c.imageUrl}" target="_blank" rel="noopener" class="btn-drawer-close">RAW ↗</a>
          <button type="button" id="btn-lb-close" class="btn-drawer-close">[Esc] ✕</button>
        </div>
      </div>
      <div class="lightbox-stage" id="lightbox-backdrop">
        <img src="${c.fullUrl || c.imageUrl}" alt="${c.character || 'Full Artwork'}" class="lightbox-full-img" />
      </div>
    `;

    overlay.querySelector('#btn-lb-close')?.addEventListener('click', () => this.closeCardLightbox());
    overlay.querySelector('#btn-lb-slideshow-toggle')?.addEventListener('click', () => this.toggleSlideshowPlayPause());
    overlay.querySelector('#btn-lb-slideshow-mode')?.addEventListener('click', () => this.toggleSlideshowSourceMode());
    overlay.querySelector('#btn-lb-sec-dec')?.addEventListener('click', () => this.adjustSlideshowInterval(-1));
    overlay.querySelector('#btn-lb-sec-inc')?.addEventListener('click', () => this.adjustSlideshowInterval(1));
    overlay.querySelectorAll('.btn-sec-preset[data-sec]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setSlideshowIntervalSec(Number(btn.dataset.sec));
      });
    });
    overlay.querySelector('#btn-lb-prev')?.addEventListener('click', () => this.stepLightboxCard(-1));
    overlay.querySelector('#btn-lb-next')?.addEventListener('click', () => {
      if (this.slideshowActive && this.slideshowMode === 'stream') {
        this.advanceSlideshowSlide(true);
      } else {
        this.stepLightboxCard(1);
      }
    });
    overlay.querySelector('#btn-lb-native-fs')?.addEventListener('click', () => this.toggleNativeFullscreen(overlay));
    overlay.querySelector('#lightbox-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'lightbox-backdrop') this.closeCardLightbox();
    });

    // If slideshow is currently running, trigger the progress bar transition
    if (isRunning) {
      const bar = document.getElementById('lightbox-progress-bar');
      if (bar) {
        const durationMs = intervalSec * 1000;
        bar.style.transition = 'none';
        bar.style.width = '0%';
        void bar.offsetWidth;
        bar.style.transition = `width ${durationMs}ms linear`;
        bar.style.width = '100%';
      }
    }
  }

  stepLightboxCard(dir = 1, fromSlideshow = false) {
    const cards = flowStore.getCardCollection();
    if (cards.length <= 1) return;
    if (!fromSlideshow) audioEngine.playClick();
    this.lightboxIndex = (this.lightboxIndex + dir + cards.length) % cards.length;
    this.lightboxCard = cards[this.lightboxIndex];
    this.renderLightboxDOM();
    if (this.slideshowActive && !this.slideshowPaused && !fromSlideshow) {
      this.scheduleNextSlide();
    }
  }

  toggleNativeFullscreen(targetEl) {
    if (!document.fullscreenElement) {
      (targetEl || document.documentElement).requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  closeCardLightbox() {
    this.slideshowActive = false;
    this.slideshowPaused = false;
    this.stopSlideshowTimer();
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    const overlay = document.getElementById('card-lightbox-overlay');
    if (overlay) {
      overlay.style.display = 'none';
      overlay.innerHTML = '';
    }
  }

  /**
   * Opens the Rating Calibrator, Auto-Calibration, & Telemetry Modal.
   */
  openRatingModal() {
    audioEngine.playClick();
    const overlay = document.getElementById('rating-telemetry-overlay');
    if (!overlay) return;
    this.renderRatingModalContent();
    overlay.style.display = 'flex';
    const inputEl = document.getElementById('input-custom-tr');
    if (inputEl) {
      setTimeout(() => {
        inputEl.focus();
        inputEl.select();
      }, 30);
    }
  }

  closeRatingModal() {
    const overlay = document.getElementById('rating-telemetry-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  applyCustomRating(newTr, shouldPullFlow = false) {
    const updated = flowStore.setTrainingRating(newTr);
    if (!updated) {
      this.showToast('Invalid rating value.', 'error');
      return;
    }
    audioEngine.playChime();
    this.userState = updated;
    this.updateHudDOM();
    if (this.zen && this.zen.currentProblem) {
      this.zen.populateDOM(this.zen.currentProblem);
    }
    const cfMeta = atcoderToCodeforces(updated.training_rating);
    this.showToast(`Practice Rating set to ${updated.training_rating} [CF ${cfMeta.cfRating} ${cfMeta.title}]`, 'ac-toast');
    if (shouldPullFlow) {
      this.closeRatingModal();
      this.startFlowSession('flow');
    } else {
      this.renderRatingModalContent();
    }
  }

  autoCalibrateRating(shouldPullFlow = false) {
    const res = flowStore.autoCalibrateRatingFromSolved();
    if (!res || !res.calibrated) {
      this.showToast(res?.reason || 'Could not auto-calibrate. Sync AtCoder handle first.', 'error');
      return;
    }
    audioEngine.playChime();
    this.userState = res.state;
    this.updateHudDOM();
    if (this.zen && this.zen.currentProblem) {
      this.zen.populateDOM(this.zen.currentProblem);
    }
    this.showToast(`⚡ Auto-Calibrated Rating to ${res.newTr} (from top ${res.sampleSize} solved problems, peak ${res.topPeak})!`, 'ac-toast');
    if (shouldPullFlow) {
      this.closeRatingModal();
      this.startFlowSession('flow');
    } else {
      this.renderRatingModalContent();
    }
  }

  renderRatingModalContent() {
    const container = document.getElementById('rating-telemetry-body');
    if (!container) return;

    const tel = flowStore.getTelemetrySummary();
    const tr = Math.round(tel.currentRating || 1200);
    const atMeta = getAtcoderMeta(tr);
    const cfMeta = atcoderToCodeforces(tr);

    // Build SVG Sparkline from tel.ratingSeries
    const series = tel.ratingSeries || [{ rating: tr }];
    const svgW = 520;
    const svgH = 90;
    const ratings = series.map(p => p.rating);
    const minR = Math.min(...ratings, tr - 100);
    const maxR = Math.max(...ratings, tr + 100);
    const spanR = Math.max(100, maxR - minR);
    const pts = series.map((pt, idx) => {
      const x = series.length === 1 ? svgW / 2 : 16 + (idx / (series.length - 1)) * (svgW - 32);
      const y = svgH - 16 - ((pt.rating - minR) / spanR) * (svgH - 32);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const presets = [
      { tr: 800, label: '800 Green', color: '#2ecc71' },
      { tr: 1000, label: '1000 Green+', color: '#2ecc71' },
      { tr: 1200, label: '1200 Cyan', color: '#00e5ff' },
      { tr: 1400, label: '1400 Cyan+', color: '#00e5ff' },
      { tr: 1600, label: '1600 Blue', color: '#4a90e2' },
      { tr: 1800, label: '1800 Blue+', color: '#4a90e2' },
      { tr: 2000, label: '2000 Yellow', color: '#f1c40f' },
      { tr: 2400, label: '2400 Orange', color: '#e67e22' }
    ];

    container.innerHTML = `
      <div class="shortcuts-modal-header">
        <div>
          <strong>PRACTICE RATING CALIBRATOR & TELEMETRY</strong>
          <span class="shortcuts-sub">Directly set your target difficulty frontier, auto-calibrate from solved history, or inspect mastery</span>
        </div>
        <button id="btn-close-rating-modal" class="btn-drawer-close">[Esc] CLOSE</button>
      </div>

      <div class="rating-calibrator-section">
        <div class="rating-calibrator-top">
          <div class="rating-current-readout">
            <span class="calibrator-label">CURRENT PRACTICE RATING</span>
            <div class="calibrator-big-rating" style="color:${atMeta.color}">
              ${tr} <span class="calibrator-cf-sub" style="color:${cfMeta.color}">[CF ${cfMeta.cfRating} ${cfMeta.title}]</span>
            </div>
            <span class="calibrator-hint">Flow pulls problems around <strong>${tr}</strong> · Speed around <strong>${Math.max(100, tr - 200)}</strong> · Reach around <strong>${tr + 175}</strong></span>
          </div>

          <div class="rating-manual-controls">
            <label class="calibrator-label" for="input-custom-tr">SET CUSTOM PRACTICE RATING (100 – 3600)</label>
            <div class="rating-input-row">
              <input type="number" id="input-custom-tr" class="rating-num-input" min="100" max="3600" step="25" value="${tr}" />
              <button id="btn-apply-tr" class="btn-zen-primary">SET RATING</button>
              <button id="btn-apply-tr-pull" class="btn-flow-launch" title="Set Rating and immediately pull a new Flow problem at this level">⚡ SET & PULL PROBLEM</button>
            </div>
            <div class="rating-auto-row">
              <button id="btn-auto-calibrate-tr" class="btn-auto-calibrate" title="Compute 70th percentile of your top 15 hardest solved AtCoder problems">
                ⚡ AUTO-CALIBRATE FROM MY SOLVED HISTORY (${tel.totalSolved} AC)
              </button>
            </div>
          </div>
        </div>

        <div class="rating-presets-bar">
          <span class="calibrator-label">1-TAP TIER PRESETS (CLICK TO JUMP & PULL):</span>
          <div class="rating-preset-chips">
            ${presets.map(p => `
              <button class="btn-rating-preset ${Math.abs(tr - p.tr) < 50 ? 'active' : ''}" data-tr="${p.tr}" style="border-color:${p.color}55; color:${p.color};">
                ${p.label}
              </button>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="telemetry-grid-section">
        <div class="telemetry-col">
          <div class="telemetry-panel-title">
            <span>RATING TRAJECTORY & FRONTIER LEAPS</span>
            <span style="color:var(--text-muted); font-size:0.72rem;">⚑ Review Queue: ${tel.reviewCount} · 📝 Notes: ${tel.notesCount}</span>
          </div>
          <div class="sparkline-box">
            <svg viewBox="0 0 ${svgW} ${svgH}" width="100%" height="${svgH}">
              <line x1="16" y1="${svgH - 16}" x2="${svgW - 16}" y2="${svgH - 16}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="3,3" />
              <polyline fill="none" stroke="var(--accent-cyan)" stroke-width="2.2" points="${pts}" />
              ${series.map((pt, idx) => {
                const x = series.length === 1 ? svgW / 2 : 16 + (idx / (series.length - 1)) * (svgW - 32);
                const y = svgH - 16 - ((pt.rating - minR) / spanR) * (svgH - 32);
                const dotColor = pt.outcome === 'give_up' ? '#ff4757' : (pt.frontier ? '#f1c40f' : '#00e5ff');
                return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" fill="${dotColor}" />`;
              }).join('')}
            </svg>
            <div class="sparkline-caption">
              <span>Range: ${Math.round(minR)} – ${Math.round(maxR)}</span>
              <span>Tip: Solving problems &gt;100 above your rating triggers a <strong>35% Fast Frontier Leap</strong></span>
            </div>
          </div>

          <div class="telemetry-panel-title" style="margin-top:12px;">
            <span>LOCAL STATE BACKUP & RESTORE</span>
          </div>
          <div class="backup-actions-row">
            <button id="btn-export-backup" class="btn-icon">⬇ EXPORT BACKUP (.JSON)</button>
            <label for="input-import-backup" class="btn-icon" style="cursor:pointer; display:inline-flex; align-items:center;">⬆ IMPORT BACKUP (.JSON)</label>
            <input type="file" id="input-import-backup" accept=".json,application/json" style="display:none;" />
          </div>
        </div>

        <div class="telemetry-col">
          <div class="telemetry-panel-title">
            <span>8-DOMAIN EMPIRICAL MASTERY</span>
            <span style="color:var(--text-muted); font-size:0.72rem;">Click domain to drill</span>
          </div>
          <div class="domain-mastery-mini-list">
            ${tel.domainStats.map(d => `
              <div class="domain-mastery-mini-row" data-domain="${d.key}" title="Click to pull a Flow problem in ${d.name}">
                <div class="dm-row-head">
                  <strong>${d.icon} ${d.name}</strong>
                  <span>${d.solved}/${d.total} (${d.pct}%) ${d.avgSolvedDiff ? `· Avg ${d.avgSolvedDiff}` : ''}</span>
                </div>
                <div class="dm-bar-track">
                  <div class="dm-bar-fill" style="width:${Math.min(100, d.pct)}%"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    // Bind events inside modal
    document.getElementById('btn-close-rating-modal')?.addEventListener('click', () => this.closeRatingModal());

    const inputTr = document.getElementById('input-custom-tr');
    document.getElementById('btn-apply-tr')?.addEventListener('click', () => {
      if (inputTr) this.applyCustomRating(Number(inputTr.value), false);
    });
    document.getElementById('btn-apply-tr-pull')?.addEventListener('click', () => {
      if (inputTr) this.applyCustomRating(Number(inputTr.value), true);
    });
    if (inputTr) {
      inputTr.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.applyCustomRating(Number(inputTr.value), true);
        }
      });
    }

    document.getElementById('btn-auto-calibrate-tr')?.addEventListener('click', () => {
      this.autoCalibrateRating(false);
    });

    container.querySelectorAll('.btn-rating-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const presetTr = Number(btn.dataset.tr);
        this.applyCustomRating(presetTr, true);
      });
    });

    container.querySelectorAll('.domain-mastery-mini-row').forEach(row => {
      row.addEventListener('click', () => {
        const domainKey = row.dataset.domain;
        this.closeRatingModal();
        flowStore.setDomainFilter(domainKey);
        this.startFlowSession('flow', { domainFilter: domainKey });
      });
    });

    document.getElementById('btn-export-backup')?.addEventListener('click', () => {
      const jsonStr = flowStore.exportFullBackupJSON();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `atcoder-flow-backup-${this.userState.handle || 'user'}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('Exported full practice state & scratchpad notes backup.', 'ac-toast');
    });

    const importInput = document.getElementById('input-import-backup');
    if (importInput) {
      importInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const res = flowStore.importFullBackupJSON(String(reader.result));
            this.fetchUserState();
            this.table.fetchProblems();
            this.renderRatingModalContent();
            this.showToast(`Restored backup (${res.solved} AC, Rating ${Math.round(res.rating)}, ${res.restoredNotes} notes)!`, 'ac-toast');
          } catch (err) {
            this.showToast(`Import failed: ${err.message}`, 'error');
          }
        };
        reader.readAsText(file);
      });
    }
  }

  /**
   * Universal Command Palette (Ctrl+K / /)
   */
  toggleCommandPalette() {
    const overlay = document.getElementById('cmd-palette-overlay');
    if (!overlay) return;
    if (overlay.style.display !== 'none') {
      this.closeCommandPalette();
    } else {
      this.openCommandPalette();
    }
  }

  openCommandPalette() {
    audioEngine.playClick();
    const overlay = document.getElementById('cmd-palette-overlay');
    const input = document.getElementById('cmd-palette-input');
    if (!overlay || !input) return;
    overlay.style.display = 'flex';
    input.value = '';
    this.cmdSelectedIndex = 0;
    this.renderCommandPaletteResults('');
    setTimeout(() => input.focus(), 20);
  }

  closeCommandPalette() {
    const overlay = document.getElementById('cmd-palette-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  handleCommandPaletteKey(e) {
    const items = this.cmdCurrentItems || [];
    if (e.key === 'Escape') {
      e.preventDefault();
      this.closeCommandPalette();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (items.length > 0) {
        this.cmdSelectedIndex = (this.cmdSelectedIndex + 1) % items.length;
        this.highlightCommandPaletteSelection();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length > 0) {
        this.cmdSelectedIndex = (this.cmdSelectedIndex - 1 + items.length) % items.length;
        this.highlightCommandPaletteSelection();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = items[this.cmdSelectedIndex];
      if (chosen && typeof chosen.action === 'function') {
        this.closeCommandPalette();
        chosen.action();
      }
    }
  }

  highlightCommandPaletteSelection() {
    const container = document.getElementById('cmd-palette-results');
    if (!container) return;
    const rows = container.querySelectorAll('.cmd-result-item');
    rows.forEach((r, idx) => {
      r.classList.toggle('selected', idx === this.cmdSelectedIndex);
      if (idx === this.cmdSelectedIndex) {
        r.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  renderCommandPaletteResults(rawQuery = '') {
    const container = document.getElementById('cmd-palette-results');
    if (!container) return;

    const q = rawQuery.trim().toLowerCase();
    const items = [];

    // 1. Check if user typed a numeric rating (e.g., "1500" or "rating 1600")
    const numMatch = q.match(/^(?:rating\s+|set\s+|tr\s+)?(\d{3,4})$/);
    if (numMatch) {
      const targetTr = Math.max(100, Math.min(3600, Number(numMatch[1])));
      const cfMeta = atcoderToCodeforces(targetTr);
      items.push({
        badge: '⚡ RATING',
        title: `Set Practice Rating to ${targetTr} [CF ${cfMeta.cfRating} ${cfMeta.title}] & Pull Problem`,
        sub: 'Immediately jump your training rating and launch a problem at this difficulty',
        action: () => this.applyCustomRating(targetTr, true)
      });
      items.push({
        badge: '✎ RATING',
        title: `Set Practice Rating to ${targetTr} (without pulling problem)`,
        sub: 'Update target difficulty rating in Top Bar',
        action: () => this.applyCustomRating(targetTr, false)
      });
    }

    // 2. Built-in high-leverage workflow commands
    const commands = [
      {
        badge: '✎ CALIBRATE',
        title: 'Edit Practice Rating / Open Telemetry & Backup Modal',
        sub: `Current Rating: ${Math.round(this.userState.training_rating || 1200)} · Set custom rating or view domain mastery`,
        keywords: 'rating edit calibrate telemetry stats sparkline backup export import difficulty boring easy hard',
        action: () => this.openRatingModal()
      },
      {
        badge: '⚡ AUTO-TR',
        title: 'Auto-Calibrate Practice Rating from My Solved History',
        sub: 'Sets your Practice Rating to the 70th percentile of your top 15 hardest solved problems',
        keywords: 'auto calibrate rating solved history kenkoooo boring easy',
        action: () => this.autoCalibrateRating(true)
      },
      {
        badge: '🔥 REACH',
        title: 'Pull Reach Challenge (+150 to +250 harder than current rating)',
        sub: 'Skip easy warmups and jump straight into a stretch problem',
        keywords: 'reach hard boss stretch challenge pull',
        action: () => this.startFlowSession('reach')
      },
      {
        badge: '⚑ REVIEW',
        title: `Pull from ⚑ Review Queue (${flowStore.getReviewQueueCount()} flagged problems)`,
        sub: 'Up-solve a problem you previously gave up on or bookmarked (+50% Redemption XP)',
        keywords: 'review queue bookmark upsolve redemption gave up',
        action: () => this.startFlowSession('review')
      },
      {
        badge: '⚔ GAUNTLET',
        title: 'Launch Hard Push Gauntlet (+150 -> +250 -> +400)',
        sub: '3-stage aggressive difficulty push for rapid rating progression',
        keywords: 'gauntlet hard push boss',
        action: () => {
          flowStore.setGauntletPreset('hard_push');
          this.startGauntletSession();
        }
      },
      {
        badge: '⚑ TABLE',
        title: 'Filter Practice Table to ⚑ Review Queue',
        sub: 'View all problems in your review / up-solve queue',
        keywords: 'table filter review queue bookmarks',
        action: () => {
          this.table.filterByReviewQueue(true);
          this.switchViewDOM('table');
        }
      }
    ];

    // Add 8 macro domain quick-drill actions
    CORE_DOMAINS.forEach(dom => {
      commands.push({
        badge: `${dom.icon} DOMAIN`,
        title: `Drill Domain: ${dom.name}`,
        sub: dom.subtitle,
        keywords: `domain ${dom.name.toLowerCase()} ${dom.categories.join(' ').toLowerCase()}`,
        action: () => {
          flowStore.setDomainFilter(dom.key);
          this.startFlowSession('flow', { domainFilter: dom.key });
        }
      });
    });

    for (const cmd of commands) {
      if (!q || cmd.title.toLowerCase().includes(q) || cmd.sub.toLowerCase().includes(q) || (cmd.keywords && cmd.keywords.includes(q))) {
        items.push(cmd);
      }
    }

    // 3. Search all 954 Golden Era problems
    if (q.length >= 1) {
      const allProbs = flowStore.getProblems();
      let matchedCount = 0;
      for (const p of allProbs) {
        if (matchedCount >= 18) break;
        const hay = `${p.id} ${p.title} ${p.category} ${p.domain_name} ${Math.round(p.difficulty || 0)}`.toLowerCase();
        if (hay.includes(q)) {
          matchedCount++;
          const diff = Math.round(p.difficulty || 800);
          const statusIcon = p.is_solved ? '✓ AC' : (p.in_review ? '⚑ REV' : `${diff}`);
          items.push({
            badge: statusIcon,
            title: `${p.id.toUpperCase()} — ${p.title}`,
            sub: `${p.domain_name} · ${p.category} · Diff ${diff}${p.has_notes ? ` · 📝 "${p.notes_snippet}"` : ''}`,
            action: () => this.openZenMode(p)
          });
        }
      }
    }

    this.cmdCurrentItems = items.slice(0, 24);
    if (this.cmdSelectedIndex >= this.cmdCurrentItems.length) {
      this.cmdSelectedIndex = 0;
    }

    if (this.cmdCurrentItems.length === 0) {
      container.innerHTML = `<div class="cmd-empty">No matching problems or commands. Tip: Type a number like <strong>1600</strong> to set your Practice Rating directly.</div>`;
      return;
    }

    container.innerHTML = this.cmdCurrentItems.map((item, idx) => `
      <div class="cmd-result-item ${idx === this.cmdSelectedIndex ? 'selected' : ''}" data-idx="${idx}">
        <span class="cmd-result-badge">${item.badge}</span>
        <div class="cmd-result-main">
          <div class="cmd-result-title">${item.title}</div>
          <div class="cmd-result-sub">${item.sub}</div>
        </div>
        <span class="cmd-result-enter">↵</span>
      </div>
    `).join('');

    container.querySelectorAll('.cmd-result-item').forEach(row => {
      row.addEventListener('click', () => {
        const idx = Number(row.dataset.idx);
        const chosen = this.cmdCurrentItems[idx];
        if (chosen && typeof chosen.action === 'function') {
          this.closeCommandPalette();
          chosen.action();
        }
      });
    });
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
