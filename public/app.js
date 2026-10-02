// Main Single-Page Application Controller for AtCoder Practice Platform
import { audioEngine } from './audio.js';
import { PracticeTable } from './table.js';
import { ZenFlowHUD } from './zen.js';
import { TechTreeVisualizer } from './tech_tree.js';
import { atcoderToCodeforces, getAtcoderMeta } from './rating.js';
import { flowStore } from './store.js';

class AtCoderFlowApp {
  constructor() {
    this.currentView = 'table'; // 'table' | 'techtree' | 'zen'
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
    this.checkResumeSession();
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
            <button class="tab-btn" data-view="zen" id="tab-zen-btn">ZEN MODE</button>
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
        </div>
      </header>

      <!-- View Containers -->
      <main id="main-view-container" style="display:flex; flex-direction:column; gap:20px;">
        <div id="view-table-section"></div>
        <div id="view-techtree-section" style="display:none;"></div>
        <div id="view-zen-section" style="display:none;"></div>
      </main>

      <div class="toast-container" id="toast-container"></div>
    `;
  }

  initControllers() {
    const tableEl = document.getElementById('view-table-section');
    const zenEl = document.getElementById('view-zen-section');
    const treeEl = document.getElementById('view-techtree-section');

    this.table = new PracticeTable(tableEl, {
      onProblemSelect: (prob) => this.openZenMode(prob),
      onAudioClick: () => audioEngine.playClick()
    });
    this.table.init();

    this.zen = new ZenFlowHUD(zenEl, {
      onSolveAC: (data) => {
        this.fetchUserState();
        this.table.fetchProblems();
      },
      onExit: () => this.switchView('table')
    });

    this.techTree = new TechTreeVisualizer(treeEl, {
      onNodeClick: (node) => {
        this.table.filterByCategory(node.category);
        this.switchView('table');
        this.showToast(`Filtered practice table to category: ${node.category}`);
      },
      onAudioClick: () => audioEngine.playClick()
    });
    this.techTree.init();
  }

  attachGlobalKeynav() {
    window.addEventListener('keydown', (e) => {
      const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const key = e.key;

      // When in Zen Mode, delegate to ZenFlowHUD
      if (this.currentView === 'zen') {
        this.zen.handleKeyDown(e);
        return;
      }

      // In Table View
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
        this.switchView(view);
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
    this.switchView('zen');
    this.zen.startGauntletRun();
  }

  /**
   * Automatically picks the next problem in the flow channel and launches Zen Mode with reel spin.
   */
  async startFlowSession(mode = 'flow') {
    audioEngine.playClick();
    this.showToast(`Pulling ${mode.toUpperCase()} challenge reel...`);
    try {
      const problem = flowStore.getNextFlowProblem(mode);
      if (problem) {
        this.openZenMode(problem);
      } else {
        this.showToast('Could not fetch next problem. Check practice table.', 'error');
      }
    } catch (err) {
      this.showToast(`Error: ${err.message}`, 'error');
    }
  }

  switchView(viewName) {
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
  }

  openZenMode(problem) {
    this.switchView('zen');
    this.zen.loadProblem(problem);
  }

  /**
   * Resumes active problem from localStorage if page was refreshed during a solve.
   */
  async checkResumeSession() {
    try {
      const saved = localStorage.getItem('atcoder_flow_zen_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.problem_id) {
          const prob = flowStore.getProblem(parsed.problem_id);
          if (prob && !prob.is_solved) {
            this.openZenMode(prob);
            this.showToast(`Resumed active session for ${prob.title || prob.id} (${this.zen.formatTime(parsed.elapsed_seconds || 0)})`);
          }
        }
      }
    } catch (_) {}
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
