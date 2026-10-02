// Factorio-inspired Algorithmic Tech Tree DAG Visualizer
// 25 nodes across 5 tiers with unlock thresholds, prerequisite curves, and bottleneck surfacing.
import { flowStore } from './store.js';

export class TechTreeVisualizer {
  constructor(containerEl, options = {}) {
    this.container = containerEl;
    this.options = options;
    this.nodes = [];
    this.onNodeClick = options.onNodeClick || (() => {});
    this.onAudioClick = options.onAudioClick || (() => {});
  }

  /**
   * Initializes and fetches tech tree data from backend.
   */
  async init() {
    this.renderSkeleton();
    await this.fetchTechTree();
  }

  /**
   * Renders the base wrapper container.
   */
  renderSkeleton() {
    this.container.innerHTML = `
      <div class="tech-tree-wrapper">
        <div class="tree-header">
          <div class="tree-title">FACTORIO ALGORITHMIC TECH TREE</div>
          <div class="tree-subtitle">
            Compounding skill DAG across 5 tiers. Master prerequisites to unlock higher-level algorithmic branches.
          </div>
        </div>

        <div class="tree-container" id="tree-canvas-container">
          <svg class="tree-svg-canvas" id="tree-svg-edges"></svg>
          <div class="tree-nodes-layer" id="tree-nodes-grid"></div>
        </div>
      </div>
    `;
  }

  /**
   * Fetches tech tree node states from API.
   */
  async fetchTechTree() {
    try {
      await flowStore.init();
      this.nodes = flowStore.getTechTree();
      this.renderTree();
    } catch (err) {
      const grid = this.container.querySelector('#tree-nodes-grid');
      if (grid) {
        grid.innerHTML = `<div style="padding:24px; color:var(--accent-red);">Failed to load Tech Tree: ${err.message}</div>`;
      }
    }
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
