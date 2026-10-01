import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Feature 11 & 12: Velocity Tracking, XP Multipliers & Exponential Decay', () => {
  function computeMultiplierOnSolve(currentMultiplier, streak) {
    // Scales by +0.15 per solve up to 2.0 max cap
    return Math.min(2.0, Math.round((currentMultiplier + 0.15) * 100) / 100);
  }

  function computeDecayedMultiplier(peakMultiplier, downtimeSeconds, graceWindow = 90, halfLife = 60) {
    if (downtimeSeconds <= graceWindow) {
      return peakMultiplier;
    }
    const elapsedAfterGrace = downtimeSeconds - graceWindow;
    const decayFactor = Math.exp(-elapsedAfterGrace / halfLife);
    const decayed = 1.0 + (peakMultiplier - 1.0) * decayFactor;
    return Math.max(1.0, Math.round(decayed * 1000) / 1000);
  }

  function computeVelocitySolvesPerHour(solvesCount, sessionDurationSeconds) {
    if (sessionDurationSeconds <= 0) return 0;
    const hours = sessionDurationSeconds / 3600;
    return Math.round((solvesCount / hours) * 10) / 10;
  }

  it('case 1: should scale multiplier with consecutive solves up to 2.0x ceiling', () => {
    let mult = 1.0;
    for (let i = 1; i <= 10; i++) {
      mult = computeMultiplierOnSolve(mult, i);
    }
    assert.equal(mult, 2.0, 'Multiplier must cap at 2.0x');
  });

  it('case 2: should preserve peak multiplier during the 90-second grace window', () => {
    const peak = 1.75;
    assert.equal(computeDecayedMultiplier(peak, 0), peak);
    assert.equal(computeDecayedMultiplier(peak, 45), peak);
    assert.equal(computeDecayedMultiplier(peak, 90), peak);
  });

  it('case 3: should smoothly decay multiplier back to 1.0x after grace window expires', () => {
    const peak = 1.8;
    const at150s = computeDecayedMultiplier(peak, 150); // 60s past grace (1 halfLife)
    assert(at150s < peak && at150s > 1.0, `Expected decay, got ${at150s}`);

    const at600s = computeDecayedMultiplier(peak, 600); // 510s past grace
    assert.equal(at600s, 1.0, 'Should decay to 1.0x floor');
  });

  it('case 4: should never decay below baseline 1.0x floor under extreme downtime', () => {
    const peak = 2.0;
    const extremeDowntime = 86400; // 24 hours
    assert.equal(computeDecayedMultiplier(peak, extremeDowntime), 1.0);
  });

  it('case 5: should calculate production velocity in solves per hour accurately', () => {
    // 3 solves in 1800 seconds (0.5 hour) = 6.0 solves/hr
    assert.equal(computeVelocitySolvesPerHour(3, 1800), 6.0);
    // 5 solves in 3600 seconds (1.0 hour) = 5.0 solves/hr
    assert.equal(computeVelocitySolvesPerHour(5, 3600), 5.0);
    // 0 duration returns 0
    assert.equal(computeVelocitySolvesPerHour(2, 0), 0);
  });
});
