# AtCoder Flow — Adaptive Practice Platform

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/athuvathu/atcoder-flow)

High-performance adaptive competitive programming training platform built for flow state, brutal minimalism, and zero AI slop.

## Live Deployments
- **Instant Preview**: [Cloudflare Edge Live Tunnel](https://mature-depends-sam-ceremony.trycloudflare.com)
- **1-Click Free Cloud Host**: Deploy to **[Render.com](https://render.com/deploy?repo=https://github.com/athuvathu/atcoder-flow)** for `https://atcoder-flow.onrender.com`

---

## Key Flow-State Mechanics

- **Only-Bangers Modern Curation Engine**: Restricts practice and flow reels to modern ABC (150+), ARC (100+), and Educational DP contests, eliminating archaic geometry and unrated ad-hoc noise.
- **Critical Solves & Speed Surge Dynamics**: Solves completed in $\le 50\%$ of Par time trigger Critical Solves, awarding up to $+300$ bonus performance points and $+10$ extra Training Rating.
- **Ghost Pacer Hairline Bar**: Continuous sub-pixel Par pacing bar with live Ahead/Behind deltas and dynamic color feedback.
- **3-Problem Flow Gauntlet**: Warmup $\to$ Flow $\to$ Boss Breakout runs with terminal Run Scorecards, net TR accounting, and Bank / Ascend cash-out options.
- **Zero-Latency CPH Pipeline**: Auto-dispatches problem statements and test cases directly to local CPH / Competitive Companion listeners (`:27121`) with zero clicks.
- **KaTeX Math Engine**: Native LaTeX variable and formula rendering across problem statements and sample explanations.
- **Codeforces Dual Rating System**: Empirical monotonic conversion mapping AtCoder performance to Codeforces ranks and ratings.

---

## Local Development

```bash
# Clone repository
git clone https://github.com/athuvathu/atcoder-flow.git
cd atcoder-flow

# Install dependencies (KaTeX)
npm install

# Start local server (Node 22+)
npm start
```

Runs on `http://localhost:3000` with pre-bundled SQLite database of 3,675 curated problems.
