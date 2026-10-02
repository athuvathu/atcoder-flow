---
name: atcoder-flow
description: Domain runbook for AtCoder Flow platform. Use when modifying competitive programming practice logic, Golden Era problem filters, Ghost Pacer pacing, Gauntlet mode, KaTeX math rendering, Codeforces conversions, or CPH test-case dispatching.
---

# AtCoder Flow Platform Architecture & Practice Runbook

<role>
You maintain and extend the AtCoder Flow competitive programming platform. You enforce flow state ergonomics, brutal minimalism, zero AI slop, and native developer tooling.
</role>

---

## 1. Flow-State Mechanics & Algorithms

### Only-Bangers Golden Era Problem Curation
- **Contest Filter**: In `server/db.js`, filter out archaic pre-2019 problems. Restrict problem candidate pool to modern Golden Era contests:
  - `abc` contests with number $\ge 150$ (`CAST(substr(contest_id, 4) AS INTEGER) >= 150`)
  - `arc` contests with number $\ge 100$ (`CAST(substr(contest_id, 4) AS INTEGER) >= 100`)
  - Educational DP contest (`contest_id = 'dp'`)
- **Intensity Channels**:
  - `warmup`: $[TR - 250, TR - 50]$
  - `speed`: $[TR - 200, TR - 50]$
  - `flow`: $[TR - 50, TR + 120]$ (Goldilocks 4% sweet spot)
  - `reach`: $[TR + 100, TR + 250]$
  - `boss`: $[TR + 120, TR + 350]$

### Critical Solves & Speed Surge Dynamics
- In `server/routes.js`, when a solve is recorded via `POST /api/compulsion/solve`:
  - If `elapsed_seconds <= 0.5 * par_seconds`:
    - Set `is_critical = true`.
    - Grant extra $+10$ bonus Training Rating (`rating_delta + 10`).
    - Award **Speed Surge Bonus**: up to $+300$ solve performance points:
      $$\text{bonus} = \min\left(300, \left\lfloor\frac{0.5 \cdot \text{Par} - \text{Elapsed}}{0.5 \cdot \text{Par}} \times 300\right\rfloor\right)$$
  - If `elapsed_seconds` is within $[0.85 \cdot \text{Par}, \text{Par}]$:
    - Set `is_clutch = true` and display the high-contrast amber `[CLUTCH SOLVE // PAR BEATEN]` badge.

### Ghost Pacer Real-Time Par Pacing
- In `public/zen.js` & `public/styles.css`:
  - 2px hairline bar (`.ghost-pacer-track` & `.ghost-pacer-fill`).
  - Dynamic color thresholds:
    - $< 60\%$ Par elapsed: Electric cyan (`#38bdf8`, `.pacer-fast`)
    - $60\% - 100\%$ Par elapsed: Emerald green (`#10b981`, `.pacer-onpar`)
    - $> 100\%$ Par elapsed: Amber orange (`#f59e0b`, `.pacer-over`)
  - Live delta readout in stopwatch: `+MM:SS AHEAD` or `-MM:SS OVER PAR`.

### Structured 3-Problem Gauntlet Mode
- Sequence: **Stage 1 (Warmup)** $\to$ **Stage 2 (Flow)** $\to$ **Stage 3 (Boss Breakout)**.
- Triggered by `[g]` keyboard shortcut or `[g] GAUNTLET` header button.
- Stage solves display stage celebration banner with `[Enter] Advance to Stage X`.
- Clearing Stage 3 renders the **Terminal Run Scorecard** with stage breakdown, Codeforces ranks, net TR gain, and `[Enter]` to Bank Rating or `[Space]` to Ascend.

### Zero-Latency CPH / Editor Dispatch
- In `public/zen.js`: On problem load, invoke `pushToCPH(silent = true)`.
- Dispatches problem statement, limits, and sample test cases silently to local Competitive Companion / CPH listener on port `27121`.
- Suppresses error toasts when CPH is offline to prevent UI friction.

---

## 2. Technical Stack & Invariants

| Layer | Technology | Key Files |
|:---|:---|:---|
| **Runtime** | Node.js 22 (ES Modules) | `package.json` (`"type": "module"`) |
| **Server** | Built-in `node:http` micro-server | `server/index.js`, `server/routes.js` |
| **Database** | Built-in `node:sqlite` (`DatabaseSync`) in WAL mode | `server/db.js`, `data/atcoder_flow.db` |
| **Frontend** | Vanilla JS, Web Audio API, KaTeX Math | `public/app.js`, `public/zen.js`, `public/audio.js` |
| **Styling** | Google Stitch / Unixporn pure dark monospace | `public/styles.css` |
| **Deployment** | Docker container + Render Blueprint | `Dockerfile`, `render.yaml` |

---

## 3. Web Audio Synthesis Rules

- **Zero External Audio Assets**: All sounds synthesized procedurally via `window.AudioContext`.
- **Non-Zero Exponential Ramp Floor**: Always ramp to `>= 0.0001` (never `0`) to prevent browser `DOMException`.
- **Sound Mapping**:
  - `playClick()`: Short 1200 Hz tactile click (`0.04s`).
  - `playReelTick()`: Fast pitch-descending tick (`0.035s`).
  - `playHeavyThud()`: Low 90 Hz mechanical bass transient (`0.18s`).
  - `playChime()`: Ascending 4-tone pentatonic arpeggio (`C5, E5, G5, C6`).
  - `playJackpot()`: Euphoric 6-tone ascending arpeggio (`C5, E5, G5, B5, C6, E6`) with triangle waveforms.
  - `playOdometerTick()`: 600 Hz micro-tick for counter roll-up.

---

## 4. Verification Protocol

Always verify changes using native test runner:
```bash
# Core unit & integration tests
node --test tests/unit/rating_conversion.test.js tests/integration/api_compulsion.test.js tests/unit/audio_engine.test.js

# Frontend syntax check
node --check public/app.js && node --check public/zen.js && node --check public/audio.js
```
