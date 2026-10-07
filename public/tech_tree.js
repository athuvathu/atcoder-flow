// Factorio-inspired Algorithmic Tech Tree DAG Visualizer & Core Domains
// 8 Core Pillars + 25-node micro DAG across 5 tiers with unlock thresholds and targeted drills.
import { flowStore } from './store.js';

export class TechTreeVisualizer {
  constructor(containerEl, options = {}) {
    this.container = containerEl;
    this.options = options;
    this.nodes = [];
    this.viewMode = localStorage.getItem('atcoder_tree_view') || 'domains'; // 'domains' | 'dag'
    this.onNodeClick = options.onNodeClick || (() => {});
    this.onAudioClick = options.onAudioClick || (() => {});
    this.onDomainDrill = options.onDomainDrill || (() => {});
    this.onDomainTable = options.onDomainTable || (() => {});
    this.onViewModeChange = options.onViewModeChange || (() => {});
  }

  /**
   * Initializes and fetches tech tree data from backend.
   */
  async init() {
    this.renderSkeleton();
    await this.fetchTechTree();
  }

  /**
   * Renders the base wrapper container with mode toggles and views.
   */
  renderSkeleton() {
    const isDomain = this.viewMode === 'domains';
    this.container.innerHTML = `
      <div class="tech-tree-wrapper">
        <div class="tree-header">
          <div class="tree-header-top">
            <div>
              <div class="tree-title" id="tree-view-title">${isDomain ? 'CORE DOMAIN ARCHITECTURE' : 'FACTORIO ALGORITHMIC TECH TREE'}</div>
              <div class="tree-subtitle" id="tree-view-subtitle">
                ${isDomain
                  ? 'Canonical Competitive Programming pillars with live mastery, problem density, and targeted flow drilling.'
                  : 'Compounding skill DAG across 5 tiers. Master prerequisites to unlock higher-level algorithmic branches.'}
              </div>
            </div>
            <div class="tree-mode-toggle" id="tree-mode-toggle">
              <button class="btn-tree-mode ${isDomain ? 'active' : ''}" data-mode="domains" id="toggle-domains-btn">
                <span class="mode-icon">▥</span> CORE DOMAINS
              </button>
              <button class="btn-tree-mode ${!isDomain ? 'active' : ''}" data-mode="dag" id="toggle-dag-btn">
                <span class="mode-icon">☊</span> SKILL DAG (FACTORIO)
              </button>
            </div>
          </div>
        </div>

        <div class="domain-view-container" id="domain-view-container" style="${isDomain ? '' : 'display:none;'}">
          <div class="domain-card-grid" id="domain-card-grid"></div>
        </div>

        <div class="tree-container" id="tree-canvas-container" style="${!isDomain ? '' : 'display:none;'}">
          <svg class="tree-svg-canvas" id="tree-svg-edges"></svg>
          <div class="tree-nodes-layer" id="tree-nodes-grid"></div>
        </div>
      </div>
    `;

    // Attach view mode toggle buttons
    const domBtn = this.container.querySelector('#toggle-domains-btn');
    const dagBtn = this.container.querySelector('#toggle-dag-btn');

    if (domBtn) {
      domBtn.addEventListener('click', () => {
        this.onAudioClick();
        this.switchViewMode('domains', true);
      });
    }

    if (dagBtn) {
      dagBtn.addEventListener('click', () => {
        this.onAudioClick();
        this.switchViewMode('dag', true);
      });
    }
  }

  /**
   * Sets view mode from URL route without pushing a redundant history entry.
   */
  setViewModeFromRoute(mode) {
    const target = mode === 'dag' ? 'dag' : 'domains';
    this.switchViewMode(target, false);
  }

  /**
   * Switches between Core Domains grid view and Factorio Skill DAG view.
   */
  switchViewMode(mode, notifyRoute = true) {
    if (this.viewMode === mode) {
      if (mode === 'domains') this.renderDomainView();
      else this.renderTree();
      return;
    }
    this.viewMode = mode;
    try {
      localStorage.setItem('atcoder_tree_view', mode);
    } catch (_) {}

    const titleEl = this.container.querySelector('#tree-view-title');
    const subEl = this.container.querySelector('#tree-view-subtitle');
    const domContainer = this.container.querySelector('#domain-view-container');
    const dagContainer = this.container.querySelector('#tree-canvas-container');
    const domBtn = this.container.querySelector('#toggle-domains-btn');
    const dagBtn = this.container.querySelector('#toggle-dag-btn');

    const isDomain = mode === 'domains';
    if (domBtn) domBtn.classList.toggle('active', isDomain);
    if (dagBtn) dagBtn.classList.toggle('active', !isDomain);

    if (isDomain) {
      if (titleEl) titleEl.textContent = 'CORE DOMAIN ARCHITECTURE';
      if (subEl) subEl.textContent = 'Canonical Competitive Programming pillars with live mastery, problem density, and targeted flow drilling.';
      if (domContainer) domContainer.style.display = '';
      if (dagContainer) dagContainer.style.display = 'none';
      this.renderDomainView();
    } else {
      if (titleEl) titleEl.textContent = 'FACTORIO ALGORITHMIC TECH TREE';
      if (subEl) subEl.textContent = 'Compounding skill DAG across 5 tiers. Master prerequisites to unlock higher-level algorithmic branches.';
      if (domContainer) domContainer.style.display = 'none';
      if (dagContainer) dagContainer.style.display = '';
      this.renderTree();
    }

    if (notifyRoute) {
      this.onViewModeChange(mode);
    }
  }

  /**
   * Fetches tech tree node states from API.
   */
  async fetchTechTree() {
    try {
      await flowStore.init();
      this.nodes = flowStore.getTechTree();
      if (this.viewMode === 'domains') {
        this.renderDomainView();
      } else {
        this.renderTree();
      }
    } catch (err) {
      const grid = this.container.querySelector('#tree-nodes-grid');
      const dGrid = this.container.querySelector('#domain-card-grid');
      const errHtml = `<div style="padding:24px; color:var(--accent-red);">Failed to load Tech Tree: ${err.message}</div>`;
      if (grid) grid.innerHTML = errHtml;
      if (dGrid) dGrid.innerHTML = errHtml;
    }
  }

  /**
   * Renders the 8 Canonical Core Domains overview grid.
   */
  renderDomainView() {
    const grid = this.container.querySelector('#domain-card-grid');
    if (!grid) return;

    const domains = flowStore.getDomainSummary();
    const activeDomainFilter = flowStore.getDomainFilter();

    grid.innerHTML = domains.map(d => {
      const isDrilling = activeDomainFilter === d.key;

      const nodeTags = (d.nodes || []).map(n => {
        const solved = n.solved_count || 0;
        const target = n.unlock_threshold || 4;
        return `<span class="domain-node-pill" title="${n.title}: ${solved}/${target} solves">${n.title}</span>`;
      }).join('');

      return `
        <div class="domain-card ${isDrilling ? 'active-drill' : ''}" data-domain="${d.key}">
          <div class="domain-card-header">
            <div class="domain-title-group">
              <span class="domain-icon">${d.icon}</span>
              <div class="domain-title-text">
                <div class="domain-name">${d.name}</div>
                <div class="domain-meta-sub">${d.solved_count} / ${d.total_problems} Solved (${d.mastery_percent}% Mastery)</div>
              </div>
            </div>
            ${isDrilling ? '<span class="domain-drilling-pill">ACTIVE DRILL</span>' : ''}
          </div>

          <div class="domain-tagline">${d.tagline}</div>

          <div class="domain-progress-track">
            <div class="domain-progress-fill" style="width: ${d.mastery_percent}%;"></div>
          </div>

          <div class="domain-nodes-row">
            <div class="domain-nodes-label">SKILL BRANCHES:</div>
            <div class="domain-nodes-pills">${nodeTags || '<span class="domain-node-pill">Ad-Hoc / Fundamental</span>'}</div>
          </div>

          <div class="domain-card-actions">
            <button class="btn-domain-action btn-drill-domain" data-domain="${d.key}">
              ⚡ Drill Flow [${d.name.split(' ')[0]}]
            </button>
            <button class="btn-domain-action btn-table-domain" data-domain="${d.key}">
              ☰ View Problems (${d.total_problems})
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach click events on action buttons
    grid.querySelectorAll('.btn-drill-domain').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onAudioClick();
        const domainKey = btn.dataset.domain;
        if (this.onDomainDrill) {
          this.onDomainDrill(domainKey);
        }
      });
    });

    grid.querySelectorAll('.btn-table-domain').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onAudioClick();
        const domainKey = btn.dataset.domain;
        if (this.onDomainTable) {
          this.onDomainTable(domainKey);
        }
      });
    });
  }

  /**
   * Identifies the current active bottleneck node in the tree.
   * Priority: lowest tier available node with fewest remaining solves.
   */
  findBottleneckNode() {
    const availableNodes = this.nodes.filter(n => n.status === 'available' || (n.is_unlocked && !n.is_mastered));
    if (availableNodes.length === 0) return null;

    availableNodes.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      const remA = Math.max(0, (a.unlock_threshold || a.required_solves || 3) - (a.solved_count || 0));
      const remB = Math.max(0, (b.unlock_threshold || b.required_solves || 3) - (b.solved_count || 0));
      return remA - remB;
    });

    return availableNodes[0];
  }

  /**
   * Renders the node cards into 5 tier columns and draws SVG edges.
   */
  renderTree() {
    const grid = this.container.querySelector('#tree-nodes-grid');
    if (!grid) return;

    const bottleneck = this.findBottleneckNode();

    // Group nodes by tier (1..5)
    let columnsHtml = '';
    for (let tier = 1; tier <= 5; tier++) {
      const tierNodes = this.nodes.filter(n => n.tier === tier);
      columnsHtml += `
        <div class="tier-column" data-tier="${tier}">
          <div class="tier-header">Tier ${tier}</div>
          ${tierNodes.map(node => {
            const isBottleneck = bottleneck && (node.node_id || node.id) === (bottleneck.node_id || bottleneck.id);
            const status = node.status || (node.is_mastered ? 'mastered' : node.is_unlocked ? 'available' : 'locked');
            const targetSolves = node.unlock_threshold || node.required_solves || 4;
            const currentSolves = node.solved_count || 0;
            const nodeId = node.node_id || node.id;

            return `
              <div class="tree-node-card ${status} ${isBottleneck ? 'bottleneck' : ''}" 
                   id="node-${nodeId}"
                   data-node-id="${nodeId}"
                   data-category="${node.category || ''}"
                   data-status="${status}">
                <div class="node-domain-badge">${(node.parent_domain || '').replace(/_/g, ' ').toUpperCase()}</div>
                <div class="node-title">${node.title}</div>
                <div class="node-meta">
                  <span>${currentSolves} / ${targetSolves} solves</span>
                  <span class="node-status-tag">${status.toUpperCase()}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    grid.innerHTML = columnsHtml;

    // Attach click events on nodes
    grid.querySelectorAll('.tree-node-card').forEach(card => {
      card.addEventListener('click', () => {
        const status = card.dataset.status;
        const category = card.dataset.category;
        const nodeId = card.dataset.nodeId;
        this.onAudioClick();

        if (status !== 'locked') {
          this.onNodeClick({ nodeId, category, status });
        }
      });
    });

    // Draw SVG prerequisite spline connections
    // Defer slightly to ensure cards are placed and measured by the browser engine
    setTimeout(() => this.drawEdges(), 50);
  }

  /**
   * Draws cubic bezier spline curves connecting prerequisites.
   */
  drawEdges() {
    const svg = this.container.querySelector('#tree-svg-edges');
    const container = this.container.querySelector('#tree-canvas-container');
    if (!svg || !container) return;

    const containerRect = container.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${containerRect.width} ${containerRect.height}`);

    let pathsHtml = '';

    this.nodes.forEach(node => {
      const prereqs = node.prereqs || [];
      if (prereqs.length === 0) return;

      const nodeId = node.node_id || node.id;
      const targetCard = this.container.querySelector(`#node-${nodeId}`);
      if (!targetCard) return;

      const targetRect = targetCard.getBoundingClientRect();
      const targetX = targetRect.left - containerRect.left;
      const targetY = targetRect.top - containerRect.top + targetRect.height / 2;

      prereqs.forEach(prereqId => {
        const sourceCard = this.container.querySelector(`#node-${prereqId}`);
        if (!sourceCard) return;

        const sourceRect = sourceCard.getBoundingClientRect();
        const sourceX = sourceRect.right - containerRect.left;
        const sourceY = sourceRect.top - containerRect.top + sourceRect.height / 2;

        const deltaX = (targetX - sourceX) * 0.5;
        const cp1x = sourceX + deltaX;
        const cp1y = sourceY;
        const cp2x = targetX - deltaX;
        const cp2y = targetY;

        const pathD = `M ${sourceX} ${sourceY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${targetX} ${targetY}`;

        const isUnlocked = node.status === 'available' || node.is_unlocked;
        const isMastered = node.status === 'mastered' || node.is_mastered;
        const edgeClass = isMastered ? 'mastered' : isUnlocked ? 'unlocked' : '';

        pathsHtml += `<path d="${pathD}" class="tree-edge ${edgeClass}" />`;
      });
    });

    svg.innerHTML = pathsHtml;
  }
}
