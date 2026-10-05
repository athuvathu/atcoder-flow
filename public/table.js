import { flowStore, CORE_DOMAINS, classifyProblemDomain } from './store.js';

export const RATING_BANDS = [
  { name: 'Gray', min: -Infinity, max: 399, hex: '#C0C0C0' },
  { name: 'Brown', min: 400, max: 799, hex: '#B08C56' },
  { name: 'Green', min: 800, max: 1199, hex: '#3FAF3F' },
  { name: 'Cyan', min: 1200, max: 1599, hex: '#42E0E0' },
  { name: 'Blue', min: 1600, max: 1999, hex: '#8888FF' },
  { name: 'Yellow', min: 2000, max: 2399, hex: '#FFFF56' },
  { name: 'Orange', min: 2400, max: 2799, hex: '#FFB836' },
  { name: 'Red', min: 2800, max: 3199, hex: '#FF6767' },
  { name: 'Bronze', min: 3200, max: 3599, hex: '#965C2C', metallic: true },
  { name: 'Silver', min: 3600, max: 3999, hex: '#808080', metallic: true },
  { name: 'Gold', min: 4000, max: Infinity, hex: '#FFD700', metallic: true }
];

export function clipDifficulty(difficulty) {
  if (difficulty === null || difficulty === undefined) return null;
  if (difficulty >= 400) return Math.round(difficulty);
  return Math.round(400 / Math.exp(1.0 - difficulty / 400));
}

export function getRatingBand(difficulty) {
  const d = clipDifficulty(difficulty);
  if (d === null) return RATING_BANDS[0];
  for (const b of RATING_BANDS) {
    if (d >= b.min && d <= b.max) return b;
  }
  return RATING_BANDS[0];
}

export function calculateDotFill(difficulty) {
  const d = clipDifficulty(difficulty);
  if (d === null || d <= 0) return 0;
  const bandStart = Math.floor(d / 400) * 400;
  return Math.round(Math.min((d - bandStart) / 400, 1) * 100);
}

export class PracticeTable {
  constructor(containerEl, options = {}) {
    this.container = containerEl;
    this.options = options;
    this.problems = [];
    this.filteredProblems = [];
    this.selectedIndex = 0;

    // Filters state
    this.contestFilter = 'ALL'; // ALL, ABC, ARC, AGC
    this.minDiff = 1000;
    this.maxDiff = 1500;
    this.categoryFilter = 'ALL';
    this.domainFilter = 'ALL';
    this.searchQuery = '';
    this.unsolvedOnly = false;
    this.hideDifficulty = false;

    this.onProblemSelect = options.onProblemSelect || (() => {});
    this.onAudioClick = options.onAudioClick || (() => {});
  }

  /**
   * Initializes the practice table container DOM structure.
   */
  init() {
    this.renderSkeleton();
    this.attachEventListeners();
    this.fetchProblems();
  }

  /**
   * Renders the layout skeleton including filter bar, keynav HUD, and table wrapper.
   */
  renderSkeleton() {
    this.container.innerHTML = `
      <div class="filter-bar">
        <div class="filter-group">
          <span class="filter-label">Contest:</span>
          <div class="contest-btn-group" id="contest-filter-group">
            <button class="contest-btn active" data-contest="ALL">ALL</button>
            <button class="contest-btn" data-contest="ABC">ABC</button>
            <button class="contest-btn" data-contest="ARC">ARC</button>
            <button class="contest-btn" data-contest="AGC">AGC</button>
          </div>
        </div>

        <div class="filter-group">
          <span class="filter-label">Diff:</span>
          <div class="diff-range-container">
            <input type="number" id="min-diff-input" class="diff-input" value="${this.minDiff}" step="50" min="0" max="4000" />
            <span style="color:var(--text-muted)">–</span>
            <input type="number" id="max-diff-input" class="diff-input" value="${this.maxDiff}" step="50" min="0" max="4000" />
          </div>
        </div>

        <div class="filter-group" id="table-domain-chip-group" style="${this.domainFilter !== 'ALL' ? '' : 'display:none;'}">
          <span class="active-domain-chip" id="table-active-domain-chip">
            <span id="table-domain-chip-text">DOMAIN: ${this.domainFilter}</span>
            <button class="btn-clear-domain" id="btn-clear-domain" title="Clear domain filter">×</button>
          </span>
        </div>

        <div class="filter-group">
          <input type="text" id="table-search-input" class="search-input" placeholder="Search problem (title/id)..." />
        </div>

        <div class="filter-group">
          <button id="toggle-hide-diff-btn" class="toggle-switch-btn ${this.hideDifficulty ? 'active' : ''}">
            Blind Practice: ${this.hideDifficulty ? 'ON' : 'OFF'}
          </button>
          <button id="toggle-unsolved-btn" class="toggle-switch-btn ${this.unsolvedOnly ? 'active' : ''}">
            Unsolved Only
          </button>
        </div>
      </div>

      <div class="keynav-status-bar">
        <div>
          <span>Navigation:</span>
          <span class="key-badge">j</span> / <span class="key-badge">k</span> move
          <span class="key-badge">Enter</span> activate Zen
          <span class="key-badge">v</span> verify AC
          <span class="key-badge">h</span> hint
          <span class="key-badge">s</span> skip
          <span class="key-badge">m</span> mute
        </div>
        <div id="table-count-badge">Loaded 0 problems</div>
      </div>

      <div class="table-wrapper">
        <div class="practice-table" id="practice-table-body">
          <div class="table-row header">
            <div class="col-status">STATUS</div>
            <div class="col-contest">CONTEST</div>
            <div class="col-title">PROBLEM TITLE</div>
            <div class="col-diff">DIFF</div>
            <div class="col-action">ACTION</div>
          </div>
          <div id="table-rows-container">
            <div style="padding:24px; text-align:center; color:var(--text-muted);">Loading problem catalog...</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Binds UI events for filters, inputs, and buttons.
   */
  attachEventListeners() {
    // Contest buttons
    const contestGroup = this.container.querySelector('#contest-filter-group');
    if (contestGroup) {
      contestGroup.addEventListener('click', (e) => {
        const btn = e.target.closest('.contest-btn');
        if (!btn) return;
        this.onAudioClick();
        contestGroup.querySelectorAll('.contest-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.contestFilter = btn.dataset.contest;
        this.applyFilters();
      });
    }

    // Difficulty inputs
    const minInput = this.container.querySelector('#min-diff-input');
    const maxInput = this.container.querySelector('#max-diff-input');
    if (minInput && maxInput) {
      const handleDiffChange = () => {
        this.minDiff = parseInt(minInput.value, 10) || 0;
        this.maxDiff = parseInt(maxInput.value, 10) || 4000;
        this.applyFilters();
      };
      minInput.addEventListener('change', handleDiffChange);
      maxInput.addEventListener('change', handleDiffChange);
    }

    // Search input
    const searchInput = this.container.querySelector('#table-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.applyFilters();
      });
    }

    // Blind mode toggle
    const hideDiffBtn = this.container.querySelector('#toggle-hide-diff-btn');
    if (hideDiffBtn) {
      hideDiffBtn.addEventListener('click', () => {
        this.onAudioClick();
        this.setHideDifficulty(!this.hideDifficulty);
      });
    }

    // Unsolved only toggle
    const unsolvedBtn = this.container.querySelector('#toggle-unsolved-btn');
    if (unsolvedBtn) {
      unsolvedBtn.addEventListener('click', () => {
        this.onAudioClick();
        this.unsolvedOnly = !this.unsolvedOnly;
        unsolvedBtn.classList.toggle('active', this.unsolvedOnly);
        this.applyFilters();
      });
    }

    // Clear domain button
    const clearDomainBtn = this.container.querySelector('#btn-clear-domain');
    if (clearDomainBtn) {
      clearDomainBtn.addEventListener('click', () => {
        this.onAudioClick();
        this.domainFilter = 'ALL';
        this.applyFilters();
        this.updateActiveDomainChip();
      });
    }

    // Row selection and button click delegation
    const rowsContainer = this.container.querySelector('#table-rows-container');
    if (rowsContainer) {
      rowsContainer.addEventListener('click', (e) => {
        const row = e.target.closest('.row-item');
        if (!row) return;
        const idx = parseInt(row.dataset.index, 10);
        this.selectedIndex = idx;
        this.updateSelectionVisuals();
        this.onAudioClick();

        if (e.target.closest('.btn-table-action') || e.target.closest('.problem-link')) {
          e.preventDefault();
          const problem = this.filteredProblems[idx];
          if (problem) {
            this.onProblemSelect(problem);
          }
        }
      });
    }
  }

  /**
   * Sets the blind practice mode state.
   * @param {boolean} hide
   */
  setHideDifficulty(hide) {
    this.hideDifficulty = hide;
    document.body.classList.toggle('hide-difficulty', hide);
    const btn = this.container.querySelector('#toggle-hide-diff-btn');
    if (btn) {
      btn.classList.toggle('active', hide);
      btn.textContent = `Blind Practice: ${hide ? 'ON' : 'OFF'}`;
    }
    this.renderRows();
  }

  /**
   * Fetches problem dataset from backend.
   */
  async fetchProblems() {
    try {
      await flowStore.init();
      this.problems = flowStore.getProblems();
      this.applyFilters();
    } catch (err) {
      const container = this.container.querySelector('#table-rows-container');
      if (container) {
        container.innerHTML = `<div style="padding:24px; text-align:center; color:var(--accent-red);">Failed to load problems: ${err.message}</div>`;
      }
    }
  }

  /**
   * Sets category filter from external component (e.g. Tech Tree click).
   * @param {string} category
   */
  filterByCategory(category) {
    this.categoryFilter = category || 'ALL';
    this.domainFilter = 'ALL';
    this.updateActiveDomainChip();
    this.applyFilters();
  }

  /**
   * Sets domain filter from external component (e.g. Core Domain card click).
   * @param {string} domainKey
   */
  filterByDomain(domainKey) {
    this.domainFilter = domainKey || 'ALL';
    this.categoryFilter = 'ALL';
    this.updateActiveDomainChip();
    this.applyFilters();
  }

  updateActiveDomainChip() {
    const group = this.container.querySelector('#table-domain-chip-group');
    const textEl = this.container.querySelector('#table-domain-chip-text');
    if (!group || !textEl) return;

    if (this.domainFilter && this.domainFilter !== 'ALL') {
      const d = CORE_DOMAINS.find(item => item.key === this.domainFilter);
      const name = d ? d.name : this.domainFilter;
      textEl.textContent = `DOMAIN: ${name.toUpperCase()}`;
      group.style.display = 'inline-flex';
    } else {
      group.style.display = 'none';
    }
  }

  /**
   * Applies active filters and renders matching problem rows.
   */
  applyFilters() {
    this.filteredProblems = this.problems.filter(prob => {
      // Contest filter
      if (this.contestFilter !== 'ALL') {
        const c = (prob.contest_id || '').toLowerCase();
        if (this.contestFilter === 'ABC' && !c.startsWith('abc')) return false;
        if (this.contestFilter === 'ARC' && !c.startsWith('arc')) return false;
        if (this.contestFilter === 'AGC' && !c.startsWith('agc')) return false;
      }

      // Domain filter
      if (this.domainFilter && this.domainFilter !== 'ALL') {
        if (classifyProblemDomain(prob) !== this.domainFilter) return false;
      }

      // Difficulty range bounds
      const diff = prob.difficulty !== null ? prob.difficulty : -9999;
      if (diff < this.minDiff || diff > this.maxDiff) return false;

      // Category filter
      if (this.categoryFilter !== 'ALL' && prob.category !== this.categoryFilter) {
        return false;
      }

      // Unsolved only
      if (this.unsolvedOnly && prob.is_solved) {
        return false;
      }

      // Search query
      if (this.searchQuery) {
        const titleMatch = (prob.title || '').toLowerCase().includes(this.searchQuery);
        const idMatch = (prob.id || '').toLowerCase().includes(this.searchQuery);
        if (!titleMatch && !idMatch) return false;
      }

      return true;
    });

    if (this.selectedIndex >= this.filteredProblems.length) {
      this.selectedIndex = Math.max(0, this.filteredProblems.length - 1);
    }

    const countBadge = this.container.querySelector('#table-count-badge');
    if (countBadge) {
      countBadge.textContent = `Showing ${this.filteredProblems.length} of ${this.problems.length} problems`;
    }

    this.renderRows();
  }

  /**
   * Renders the rows inside #table-rows-container.
   */
  renderRows() {
    const container = this.container.querySelector('#table-rows-container');
    if (!container) return;

    if (this.filteredProblems.length === 0) {
      container.innerHTML = `<div style="padding:32px; text-align:center; color:var(--text-muted);">No problems match current filters.</div>`;
      return;
    }

    // Limit visible DOM rows for fast 60fps rendering (virtual-like batching)
    const maxVisible = 100;
    const visibleProblems = this.filteredProblems.slice(0, maxVisible);

    const rowsHtml = visibleProblems.map((prob, idx) => {
      const isSelected = idx === this.selectedIndex;
      const band = getRatingBand(prob.difficulty);
      const fillPct = calculateDotFill(prob.difficulty);
      const isSolved = Boolean(prob.is_solved);
      const clippedDiff = clipDifficulty(prob.difficulty);

      // Dot background style
      let dotStyle = '';
      let dotClasses = 'rating-circle';
      if (band.metallic) {
        if (band.name === 'Bronze') dotClasses += ' metallic-bronze';
        else if (band.name === 'Silver') dotClasses += ' metallic-silver';
        else dotClasses += ' metallic-gold';
      } else {
        dotStyle = `border: 1px solid ${band.hex}; background: linear-gradient(to top, ${band.hex} 0%, ${band.hex} ${fillPct}%, transparent ${fillPct}%, transparent 100%);`;
      }

      // Title color depends on rating band unless blind mode is active
      const titleColor = this.hideDifficulty ? 'var(--text-primary)' : band.hex;

      return `
        <div class="table-row row-item ${isSelected ? 'selected' : ''}" data-index="${idx}" data-id="${prob.id}">
          <div class="col-status">
            ${isSolved 
              ? `<span class="status-badge ac">[AC]</span>` 
              : `<span class="status-badge unsolved">[--]</span>`}
          </div>
          <div class="col-contest">${(prob.contest_id || '').toUpperCase()}</div>
          <div class="col-title" style="color: ${titleColor};">
            <a href="#" class="problem-link" data-id="${prob.id}">${prob.title || prob.id}</a>
            ${prob.category ? `<span class="category-tag">${prob.category}</span>` : ''}
          </div>
          <div class="col-diff">
            <span class="${dotClasses}" style="${dotStyle}" title="Rating: ${clippedDiff}"></span>
            <span class="diff-value" style="color:${band.hex}">${clippedDiff !== null ? clippedDiff : '-'}</span>
          </div>
          <div class="col-action">
            <button class="btn-table-action" data-id="${prob.id}">ZEN</button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = rowsHtml;
    this.updateSelectionVisuals();
  }

  /**
   * Updates visual row selection highlight.
   */
  updateSelectionVisuals() {
    const rows = this.container.querySelectorAll('.table-row.row-item');
    rows.forEach((row, idx) => {
      row.classList.toggle('selected', idx === this.selectedIndex);
    });
  }

  /**
   * Moves selection down (Vim 'j').
   */
  moveDown() {
    if (this.filteredProblems.length === 0) return;
    this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredProblems.length - 1);
    this.updateSelectionVisuals();
    this.scrollSelectedIntoView();
    this.onAudioClick();
  }

  /**
   * Moves selection up (Vim 'k').
   */
  moveUp() {
    if (this.filteredProblems.length === 0) return;
    this.selectedIndex = Math.max(0, this.selectedIndex - 1);
    this.updateSelectionVisuals();
    this.scrollSelectedIntoView();
    this.onAudioClick();
  }

  /**
   * Activates currently selected problem (Vim 'Enter').
   */
  activateSelected() {
    const selected = this.filteredProblems[this.selectedIndex];
    if (selected) {
      this.onProblemSelect(selected);
    }
  }

  /**
   * Scrolls selected row into view if out of viewport.
   */
  scrollSelectedIntoView() {
    const selectedRow = this.container.querySelector(`.table-row.row-item[data-index="${this.selectedIndex}"]`);
    if (selectedRow) {
      selectedRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  /**
   * Returns problem currently selected.
   */
  getSelectedProblem() {
    return this.filteredProblems[this.selectedIndex] || null;
  }
}
