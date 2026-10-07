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

    // Filters & Sort state
    this.contestFilter = 'ALL'; // ALL, ABC, ARC, AGC
    this.minDiff = 0;
    this.maxDiff = 4000;
    this.activePreset = 'ALL';
    this.categoryFilter = 'ALL';
    this.domainFilter = 'ALL';
    this.searchQuery = '';
    this.unsolvedOnly = false;
    this.reviewOnly = false;
    this.notesOnly = false;
    this.hideDifficulty = false;
    this.sortField = 'diff'; // 'diff' | 'contest' | 'title'
    this.sortAsc = true;

    this.onProblemSelect = options.onProblemSelect || (() => {});
    this.onAudioClick = options.onAudioClick || (() => {});
    this.onFilterChange = options.onFilterChange || (() => {});
  }

  /**
   * Initializes the practice table container DOM structure.
   */
  init() {
    this.renderSkeleton();
    this.attachEventListeners();
    this.fetchProblems();
  }

  renderTable() {
    this.fetchProblems();
  }

  /**
   * Renders the layout skeleton including filter bar, difficulty band presets, and sortable table.
   */
  renderSkeleton() {
    const revCount = flowStore.getReviewQueueCount ? flowStore.getReviewQueueCount() : 0;
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
          <span class="filter-label">Band:</span>
          <div class="diff-preset-group" id="diff-preset-group">
            <button class="preset-chip active" data-preset="ALL" title="All Golden Era problems (0–4000)">ALL</button>
            <button class="preset-chip preset-zone" data-preset="ZONE" title="Problems within ±200 of your Training Rating">◎ MY ZONE</button>
            <button class="preset-chip" data-preset="0-799" style="color:#B08C56" title="Gray / Brown (<800)">&lt;800</button>
            <button class="preset-chip" data-preset="800-1199" style="color:#3FAF3F" title="Green (800–1199)">800–1200</button>
            <button class="preset-chip" data-preset="1200-1599" style="color:#42E0E0" title="Cyan (1200–1599)">1200–1600</button>
            <button class="preset-chip" data-preset="1600-1999" style="color:#8888FF" title="Blue (1600–1999)">1600–2000</button>
            <button class="preset-chip" data-preset="2000-4000" style="color:#FFFF56" title="Yellow / Orange / Red (2000+)">2000+</button>
          </div>
          <div class="diff-range-container">
            <input type="number" id="min-diff-input" class="diff-input" value="${this.minDiff}" step="50" min="0" max="4000" title="Minimum difficulty" />
            <span style="color:var(--text-muted)">–</span>
            <input type="number" id="max-diff-input" class="diff-input" value="${this.maxDiff}" step="50" min="0" max="4000" title="Maximum difficulty" />
          </div>
        </div>

        <div class="filter-group" id="table-domain-chip-group" style="${(this.domainFilter !== 'ALL' || this.categoryFilter !== 'ALL') ? '' : 'display:none;'}">
          <span class="active-domain-chip" id="table-active-domain-chip">
            <span id="table-domain-chip-text">DOMAIN: ${this.domainFilter}</span>
            <button class="btn-clear-domain" id="btn-clear-domain" title="Clear active topic/domain filter">×</button>
          </span>
        </div>

        <div class="filter-group">
          <input type="text" id="table-search-input" class="search-input" placeholder="Search problem (title / id)..." />
        </div>

        <div class="filter-group">
          <button id="toggle-review-btn" class="toggle-switch-btn toggle-review-chip ${this.reviewOnly ? 'active' : ''}" title="Filter to Spaced Repetition Up-Solve Review Queue">
            ⚑ Review (${revCount})
          </button>
          <button id="toggle-notes-btn" class="toggle-switch-btn ${this.notesOnly ? 'active' : ''}" title="Filter to problems with saved Scratchpad notes">
            📝 Notes
          </button>
          <button id="toggle-hide-diff-btn" class="toggle-switch-btn ${this.hideDifficulty ? 'active' : ''}">
            Blind: ${this.hideDifficulty ? 'ON' : 'OFF'}
          </button>
          <button id="toggle-unsolved-btn" class="toggle-switch-btn ${this.unsolvedOnly ? 'active' : ''}">
            Unsolved Only
          </button>
        </div>
      </div>

      <div class="keynav-status-bar">
        <div>
          <span>Keys:</span>
          <span class="key-badge">j</span>/<span class="key-badge">k</span> move
          <span class="key-badge">Enter</span> open workspace
          <span class="key-badge">Ctrl+K</span> / <span class="key-badge">/</span> command palette
          <span class="key-badge">f</span> instant flow
          <span class="key-badge">g</span> gauntlet
          <span class="key-badge">?</span> all shortcuts
        </div>
        <div id="table-count-badge">Loaded 0 problems</div>
      </div>

      <div class="table-wrapper">
        <div class="practice-table" id="practice-table-body">
          <div class="table-row header" id="table-sort-header">
            <div class="col-status">STATUS</div>
            <div class="col-contest sortable-col" data-sort="contest" title="Click to sort by Contest ID">
              CONTEST <span class="sort-indicator" id="sort-ind-contest"></span>
            </div>
            <div class="col-title sortable-col" data-sort="title" title="Click to sort by Problem Title">
              PROBLEM TITLE <span class="sort-indicator" id="sort-ind-title"></span>
            </div>
            <div class="col-diff sortable-col active-sort" data-sort="diff" title="Click to sort by Difficulty">
              DIFF <span class="sort-indicator" id="sort-ind-diff">▲</span>
            </div>
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
   * Binds UI events for filters, presets, sortable headers, inputs, and buttons.
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
        this.onFilterChange({
          domain: this.domainFilter,
          category: this.categoryFilter,
          contest: this.contestFilter
        });
      });
    }

    // Difficulty preset chips
    const presetGroup = this.container.querySelector('#diff-preset-group');
    const minInput = this.container.querySelector('#min-diff-input');
    const maxInput = this.container.querySelector('#max-diff-input');

    if (presetGroup) {
      presetGroup.addEventListener('click', (e) => {
        const btn = e.target.closest('.preset-chip');
        if (!btn) return;
        this.onAudioClick();
        presetGroup.querySelectorAll('.preset-chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const preset = btn.dataset.preset;
        this.activePreset = preset;

        if (preset === 'ALL') {
          this.minDiff = 0;
          this.maxDiff = 4000;
        } else if (preset === 'ZONE') {
          const tr = flowStore.getUserState()?.training_rating || 1200;
          this.minDiff = Math.max(0, Math.round(tr - 200));
          this.maxDiff = Math.min(4000, Math.round(tr + 200));
        } else {
          const [lo, hi] = preset.split('-').map(Number);
          this.minDiff = lo;
          this.maxDiff = hi;
        }

        if (minInput) minInput.value = this.minDiff;
        if (maxInput) maxInput.value = this.maxDiff;
        this.applyFilters();
      });
    }

    // Difficulty numeric inputs
    if (minInput && maxInput) {
      const handleDiffChange = () => {
        this.minDiff = parseInt(minInput.value, 10) || 0;
        this.maxDiff = parseInt(maxInput.value, 10) || 4000;
        if (presetGroup) {
          presetGroup.querySelectorAll('.preset-chip').forEach(b => b.classList.remove('active'));
        }
        this.applyFilters();
      };
      minInput.addEventListener('change', handleDiffChange);
      maxInput.addEventListener('change', handleDiffChange);
    }

    // Sortable column headers
    const sortHeader = this.container.querySelector('#table-sort-header');
    if (sortHeader) {
      sortHeader.addEventListener('click', (e) => {
        const col = e.target.closest('.sortable-col');
        if (!col) return;
        this.onAudioClick();
        const field = col.dataset.sort;
        if (this.sortField === field) {
          this.sortAsc = !this.sortAsc;
        } else {
          this.sortField = field;
          this.sortAsc = field === 'contest' ? false : true;
        }
        this.updateSortHeaderUI();
        this.applyFilters();
      });
    }

    // Search input
    const searchInput = this.container.querySelector('#table-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.applyFilters();
      });
    }

    // Review Queue toggle
    const reviewBtn = this.container.querySelector('#toggle-review-btn');
    if (reviewBtn) {
      reviewBtn.addEventListener('click', () => {
        this.onAudioClick();
        this.reviewOnly = !this.reviewOnly;
        reviewBtn.classList.toggle('active', this.reviewOnly);
        this.applyFilters();
      });
    }

    // Saved Notes toggle
    const notesBtn = this.container.querySelector('#toggle-notes-btn');
    if (notesBtn) {
      notesBtn.addEventListener('click', () => {
        this.onAudioClick();
        this.notesOnly = !this.notesOnly;
        notesBtn.classList.toggle('active', this.notesOnly);
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

    // Clear domain / category button
    const clearDomainBtn = this.container.querySelector('#btn-clear-domain');
    if (clearDomainBtn) {
      clearDomainBtn.addEventListener('click', () => {
        this.onAudioClick();
        this.domainFilter = 'ALL';
        this.categoryFilter = 'ALL';
        this.applyFilters();
        this.updateActiveDomainChip();
        this.onFilterChange({
          domain: 'ALL',
          category: 'ALL',
          contest: this.contestFilter
        });
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

  filterByReviewQueue(enable = true) {
    this.reviewOnly = Boolean(enable);
    const reviewBtn = this.container.querySelector('#toggle-review-btn');
    if (reviewBtn) {
      reviewBtn.classList.toggle('active', this.reviewOnly);
    }
    this.applyFilters();
  }

  updateSortHeaderUI() {
    const fields = ['contest', 'title', 'diff'];
    fields.forEach(f => {
      const ind = this.container.querySelector(`#sort-ind-${f}`);
      const col = this.container.querySelector(`.sortable-col[data-sort="${f}"]`);
      if (col) col.classList.toggle('active-sort', this.sortField === f);
      if (ind) {
        ind.textContent = this.sortField === f ? (this.sortAsc ? '▲' : '▼') : '';
      }
    });
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
      btn.textContent = `Blind: ${hide ? 'ON' : 'OFF'}`;
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
   * Synchronizes filter state from URL hash route without pushing a redundant history state.
   */
  setFiltersFromRoute({ domain, category, contest } = {}) {
    this.domainFilter = domain || 'ALL';
    this.categoryFilter = category || 'ALL';
    if (contest) {
      this.contestFilter = contest.toUpperCase();
    } else {
      this.contestFilter = 'ALL';
    }
    const contestGroup = this.container.querySelector('#contest-filter-group');
    if (contestGroup) {
      contestGroup.querySelectorAll('.contest-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.contest === this.contestFilter);
      });
    }
    this.updateActiveDomainChip();
    this.applyFilters();
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
    } else if (this.categoryFilter && this.categoryFilter !== 'ALL') {
      textEl.textContent = `SKILL: ${this.categoryFilter.replace(/_/g, ' ').toUpperCase()}`;
      group.style.display = 'inline-flex';
    } else {
      group.style.display = 'none';
    }
  }

  /**
   * Applies active filters and sorting, then renders matching problem rows.
   */
  applyFilters() {
    // Refresh live review/notes flags on problems list
    this.problems = flowStore.getProblems();
    const reviewBtn = this.container.querySelector('#toggle-review-btn');
    if (reviewBtn && flowStore.getReviewQueueCount) {
      reviewBtn.textContent = `⚑ Review (${flowStore.getReviewQueueCount()})`;
    }

    const filtered = this.problems.filter(prob => {
      if (this.reviewOnly && !prob.in_review) return false;
      if (this.notesOnly && !prob.has_notes) return false;

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
      const diff = prob.difficulty !== null ? clipDifficulty(prob.difficulty) : -9999;
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

    const dir = this.sortAsc ? 1 : -1;
    filtered.sort((a, b) => {
      if (this.sortField === 'contest') {
        return (a.id || '').localeCompare(b.id || '', undefined, { numeric: true }) * dir;
      }
      if (this.sortField === 'title') {
        return (a.title || '').localeCompare(b.title || '') * dir;
      }
      const da = a.difficulty !== null ? a.difficulty : 99999;
      const db = b.difficulty !== null ? b.difficulty : 99999;
      return (da - db) * dir;
    });

    this.filteredProblems = filtered;

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
      const domainKey = classifyProblemDomain(prob);
      const domainLabel = domainKey.replace(/_/g, ' ').toUpperCase();

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
      const safeSnippet = (prob.notes_snippet || '').replace(/"/g, '&quot;');

      return `
        <div class="table-row row-item ${isSelected ? 'selected' : ''}" data-index="${idx}" data-id="${prob.id}">
          <div class="col-status">
            ${isSolved 
              ? `<span class="status-badge ac">[AC]</span>` 
              : prob.in_review
                ? `<span class="status-badge review-flag" title="Queued for Spaced Repetition Up-Solve">[⚑ REV]</span>`
                : `<span class="status-badge unsolved">[--]</span>`}
          </div>
          <div class="col-contest">${(prob.contest_id || '').toUpperCase()}</div>
          <div class="col-title" style="color: ${titleColor};">
            <a href="#/problem/${encodeURIComponent(prob.id)}" class="problem-link" data-id="${prob.id}">${prob.title || prob.id}</a>
            <span class="domain-row-pill">${domainLabel}</span>
            ${prob.category ? `<span class="category-tag">${prob.category}</span>` : ''}
            ${prob.in_review ? `<span class="row-review-pill" title="In Review Queue — Up-solve this problem">⚑ REVIEW</span>` : ''}
            ${prob.has_notes ? `<span class="row-notes-pill" title="Saved Note: ${safeSnippet}">📝 ${ safeSnippet.slice(0, 28) }${safeSnippet.length > 28 ? '…' : ''}</span>` : ''}
          </div>
          <div class="col-diff">
            <span class="${dotClasses}" style="${dotStyle}" title="Rating: ${clippedDiff}"></span>
            <span class="diff-value" style="color:${band.hex}">${clippedDiff !== null ? clippedDiff : '-'}</span>
          </div>
          <div class="col-action">
            <button class="btn-table-action" data-id="${prob.id}">SOLVE →</button>
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
