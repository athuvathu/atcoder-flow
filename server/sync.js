// Kenkoooo API Sync Service for AtCoder Practice Platform
import { getDb, recordSubmissions, getUserState, updateUserState } from './db.js';

const KENKOOOO_BASE_URL = 'https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions';
const USER_AGENT = 'AtCoderFlowPractice/1.0 (local practice client; user=atrv)';
const MIN_REQUEST_INTERVAL_MS = 1000; // Kenkoooo strictly requires >= 1000ms delay
const REQUEST_TIMEOUT_MS = 6000;

let lastRequestTimestamp = 0;

/**
 * Enforces Kenkoooo's rate-limiting rule (>= 1,000ms between calls).
 */
async function enforceRateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestTimestamp;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    const waitTime = MIN_REQUEST_INTERVAL_MS - elapsed;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  lastRequestTimestamp = Date.now();
}

/**
 * Fetches a single page of submissions from Kenkoooo with timeout and rate limiting.
 */
async function fetchSubmissionBatch(user, fromSecond) {
  await enforceRateLimit();

  const url = `${KENKOOOO_BASE_URL}?user=${encodeURIComponent(user)}&from_second=${fromSecond}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': USER_AGENT
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Kenkoooo API HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Performs full or incremental submission synchronization for a user handle.
 * Handles pagination (batches of 500), rate limiting, AC detection, DB ingestion,
 * and graceful fallback to local cache on network/timeout errors.
 */
export async function syncUserSubmissions(handle = 'atrv', db = getDb()) {
  console.log(`[sync] Initiating Kenkoooo submission sync for handle '${handle}'...`);

  // 1. Determine starting epoch from local cache
  let fromSecond = 0;
  try {
    const row = db.prepare('SELECT MAX(epoch_second) as max_epoch FROM submissions WHERE user_id = ?').get(handle);
    if (row && row.max_epoch) {
      fromSecond = row.max_epoch + 1;
    }
  } catch (err) {
    console.warn('[sync] Could not read max epoch from local database:', err.message);
  }

  const allFetchedSubmissions = [];
  const seenIds = new Set();
  let currentFromSecond = fromSecond;
  let hasMore = true;
  let networkFailed = false;
  let errorMessage = null;

  // 2. Paginated fetch loop
  while (hasMore) {
    try {
      const batch = await fetchSubmissionBatch(handle, currentFromSecond);
      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      let maxEpochInBatch = currentFromSecond;
      let newItemsInBatch = 0;

      for (const item of batch) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          allFetchedSubmissions.push(item);
          newItemsInBatch++;
        }
        if (item.epoch_second > maxEpochInBatch) {
          maxEpochInBatch = item.epoch_second;
        }
      }

      // Kenkoooo limits each batch to 500 items. If we received 500, fetch next page.
      if (batch.length >= 500 && newItemsInBatch > 0) {
        currentFromSecond = maxEpochInBatch;
      } else {
        hasMore = false;
      }
    } catch (err) {
      console.warn(`[sync] Network/API request failed for user '${handle}': ${err.message}. Falling back smoothly to local DB cache.`);
      networkFailed = true;
      errorMessage = err.message;
      hasMore = false;
    }
  }

  // 3. Process and record any successfully fetched submissions
  let insertedCount = 0;
  let newAcs = [];

  if (allFetchedSubmissions.length > 0) {
    try {
      const result = recordSubmissions(allFetchedSubmissions, db);
      insertedCount = result.inserted;
      newAcs = result.new_ac;

      // Update user state if new ACs arrived
      if (newAcs.length > 0) {
        const state = getUserState(handle, db);
        updateUserState(handle, {
          streak: state.streak + newAcs.length,
          last_solve_epoch: Math.max(...allFetchedSubmissions.filter(s => s.result === 'AC').map(s => s.epoch_second))
        }, db);
      }
    } catch (dbErr) {
      console.error('[sync] Failed to record fetched submissions in DB:', dbErr);
    }
  }

  // 4. Compute latest epoch & total AC count from DB for return contract
  let lastEpoch = 0;
  let totalAcCount = 0;
  try {
    const epochRow = db.prepare('SELECT MAX(epoch_second) as max_epoch FROM submissions WHERE user_id = ?').get(handle);
    if (epochRow?.max_epoch) lastEpoch = epochRow.max_epoch;

    const acCountRow = db.prepare("SELECT COUNT(DISTINCT problem_id) as count FROM submissions WHERE user_id = ? AND result = 'AC'").get(handle);
    if (acCountRow?.count) totalAcCount = acCountRow.count;
  } catch (e) {
    // fallback defaults
  }

  const syncResult = {
    synced: totalAcCount,
    count: insertedCount,
    new_ac: newAcs,
    last_epoch: lastEpoch,
    fallback_cache: networkFailed,
    error: errorMessage
  };

  console.log(`[sync] Sync result for '${handle}': synced=${syncResult.synced}, new_ac=${syncResult.new_ac.length}, last_epoch=${syncResult.last_epoch}`);
  return syncResult;
}

/**
 * Checks Kenkoooo for an AC submission on a specific problem.
 * Fetches recent submissions directly and ingests them.
 */
export async function checkProblemSubmission(handle = 'atrv', problemId, db = getDb()) {
  // First check if already in local DB
  const localRow = db.prepare("SELECT * FROM submissions WHERE user_id = ? AND problem_id = ? AND result = 'AC' LIMIT 1").get(handle, problemId);
  if (localRow) {
    return { verified: true, submission: localRow };
  }

  // Fetch recent from Kenkoooo (lookback from 2 hours ago or from epoch 0)
  try {
    const fromSecond = Math.max(0, Math.floor(Date.now() / 1000) - 7200);
    const batch = await fetchSubmissionBatch(handle, fromSecond);
    if (Array.isArray(batch) && batch.length > 0) {
      recordSubmissions(batch, db);
      const matched = batch.find(s => s.problem_id === problemId && s.result === 'AC');
      if (matched) {
        return { verified: true, submission: matched };
      }
    }
  } catch (err) {
    console.warn(`[sync] Problem check error for ${problemId}:`, err.message);
  }

  return { verified: false, lag_possible: true };
}

