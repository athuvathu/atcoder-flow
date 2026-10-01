# Original User Request

## Initial Request — 2026-09-29T17:55:40Z

A high-performance, clean-dark (unixporn / atcoder-categories aesthetic) adaptive AtCoder practice platform engineered around Factorio-like compounding feedback loops, Kotler's neurochemical flow triggers, and behavioral psychology to maximize problem-solving throughput without friction or visual noise.

Working directory: /home/atrv/Desktop/atcoder
Integrity mode: development

Reference Materials:
- AtCoder Categories Ladder & Tag Architecture: https://atcoder-categories.github.io/practice.html (clean dark table, category-based progression without tag spoilers, contest filters, diff sliders)
- AtCoder Problems / Kenkoooo Public API: https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=atrv (Default user handle: `atrv`; live submission sync and difficulty models)
- Research Foundation: Kotler's Flow Triggers (challenge/skills 4% sweet spot, transient hypofrontality, dopamine-norepinephrine focus tightening), Factorio's Compulsion Loop (continuous bottleneck surfacing, tech-tree unlocks, zero post-reinforcement pause), Yu-kai Chou's Octalysis Framework (Accomplishment, Empowerment, Loss Avoidance, Curiosity).

## Requirements

### R1. Minimalist Dark UI & Zen Flow Interface (atcoder-categories / unixporn style)
A clean, pitch-dark dashboard modeled after `atcoder-categories.github.io/practice.html` (subtle vertical grid pinstripes, matte obsidian background `#08080a`, hairline slate borders `#1e1f26`, monospace typography, discrete AtCoder color rating dots, contest filters ABC/ARC/AGC/All, difficulty bounds, and Hide Difficulty toggle). Includes an integrated Zen Flow mode with keyboard-driven navigation (`j`/`k` to select, `Enter` to activate, `v` to verify, `h` for hint, `s` to skip).

### R2. Factorio-Inspired Compulsion Loops & Algorithmic Tech Tree
Implement compounding progression loops inspired by manufacturing and skill-tree games:
- **Algorithmic Tech Tree**: Categories structured as an unlockable skill tree (e.g., Graph Basics → Dijkstra → Topo Sort → SCC; Prefix Sums → Two Pointers → Coordinate Compression). Clearing tiers unlocks higher-level problem branches.
- **Zero-Downtime Bottleneck Priming**: To eliminate the post-reinforcement pause (decision fatigue after solving a problem), the system immediately primes the next optimal problem in the active branch upon AC.
- **Throughput & Production Velocity**: Real-time display of solves/hour, time-in-flow velocity, and compounding XP multipliers that decay if downtime exceeds a grace window.

### R3. Neurochemical Flow Triggers & Scaffolded Invariant Hints
- **Goldilocks 4% Challenge Tuning**: Dynamically serve problems in the user's flow channel (calibrated to the user's rating boundary, ~+50 to +200 rating) using Kenkoooo difficulty models to balance boredom and anxiety.
- **Anti-Despair Hint Ladder**: When the struggle phase threatens to break flow, a 3-tier progressive non-spoiler hint ladder provides structured nudges without giving away tags or code:
  1. *Observation / Invariant Nudge* (e.g. parity, monotonicity, prefix invariant).
  2. *Reduction / Modeling Nudge* (e.g. graph transformation, meet-in-the-middle).
  3. *Complexity & Data Structure Bound* (e.g. $O(N \log N)$ threshold, coordinate compression).

### R4. Real AtCoder API Sync & Low-Friction C++ Ergonomics
- Real-time submission polling and verification via Kenkoooo API for handle `atrv`.
- Detects accepted submissions automatically and triggers immediate acoustic/visual reinforcement (procedural Web Audio mechanical click/chime, XP burst, streak preservation).
- Frictionless local workspace: provides problem links, sample test inputs/outputs, and 1-click boilerplate setup for C++23.
- All session states, streak tallies, tech tree nodes, and cached submissions persist locally.

## Acceptance Criteria

### UI & Aesthetics
- [ ] A local web server launches cleanly from `/home/atrv/Desktop/atcoder` and serves a clean dark, grid-patterned monospace interface matching `atcoder-categories.github.io/practice.html`.
- [ ] Table cleanly renders problem code, title, AtCoder difficulty band indicator, and solve status.
- [ ] Contest filters (ABC, ARC, AGC, All), difficulty range, and "Hide Difficulty" toggle operate smoothly.
- [ ] Keyboard navigation and procedural Web Audio feedback (clicks, chimes) function with mute controls and zero missing external assets.

### Progression & Flow Mechanics
- [ ] Active problem view displays elapsed session timer, target pace, and the 3-step scaffolded hint ladder.
- [ ] Consecutive solves increment streaks and scale session XP multipliers.
- [ ] Category tech tree unlocks higher difficulty nodes as earlier tiers are cleared.
- [ ] Immediate next-problem transition maintains continuous practice flow without idle screens.

### Data & Sync Integrity
- [ ] Syncing user handle `atrv` fetches real submission history from the AtCoder Problems API and correctly flags completed problems.
- [ ] Unsolved problems in the user's target difficulty range (1000 - 1500) are recommended cleanly.
- [ ] User state, streak, and preferences persist across browser reloads.
