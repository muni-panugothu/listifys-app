/**
 * OfflineQueueManager
 *
 * Persists user actions that require internet connectivity (toggle-save, chat
 * message, profile update) to AsyncStorage so they survive app restarts.
 * When connectivity is restored, SyncManager drains the queue with exponential
 * back-off retry logic.
 *
 * Queue Item Types:
 *   - TOGGLE_SAVE  : add/remove a listing from favourites
 *   - SEND_MESSAGE : send a chat message
 *   - PROFILE_UPDATE : update profile fields
 *
 * Architecture:
 *   OfflineQueueManager (this file)  — pure storage + retry logic, no UI
 *   NetworkStatusLayer               — triggers drainQueue() on reconnect
 *   Individual feature screens       — call enqueue() when offline
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const QUEUE_STORAGE_KEY = "@listify/offline_queue_v1";

// ── Retry policy (exponential back-off with jitter) ──────────────────────────
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;

function retryDelay(attempt: number): number {
  const exponential = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
  // Add ±20% jitter to prevent thundering herd.
  const jitter = exponential * 0.2 * (Math.random() * 2 - 1);
  return Math.round(exponential + jitter);
}

// ── Queue Item Types ──────────────────────────────────────────────────────────

export type ToggleSaveAction = {
  type: "TOGGLE_SAVE";
  payload: {
    category: string;
    listingId: string;
    /** true = save, false = unsave */
    targetState: boolean;
  };
};

export type SendMessageAction = {
  type: "SEND_MESSAGE";
  payload: {
    conversationId: string;
    content: string;
    messageType?: "text" | "image";
    localId: string;
  };
};

export type ProfileUpdateAction = {
  type: "PROFILE_UPDATE";
  payload: Record<string, unknown>;
};

export type QueuedAction =
  | ToggleSaveAction
  | SendMessageAction
  | ProfileUpdateAction;

export type QueueItem = {
  id: string;
  action: QueuedAction;
  createdAt: number;
  attempts: number;
  /** Epoch ms before which we must not retry (exponential back-off). */
  nextRetryAt: number;
  lastError?: string;
};

// ── Executor map — registered by feature modules at startup ──────────────────

type Executor = (item: QueueItem) => Promise<void>;

const executors = new Map<QueuedAction["type"], Executor>();

/**
 * Register an executor for a specific action type.
 * Called once at app startup from the relevant feature module.
 *
 * Example:
 *   registerQueueExecutor("TOGGLE_SAVE", async (item) => {
 *     const { category, listingId } = (item.action as ToggleSaveAction).payload;
 *     await toggleSaveListing(category, listingId);
 *   });
 */
export function registerQueueExecutor(type: QueuedAction["type"], executor: Executor): void {
  executors.set(type, executor);
}

// ── Internal state ─────────────────────────────────────────────────────────────

let _queue: QueueItem[] = [];
let _loaded = false;
let _draining = false;

// ── Persistence ───────────────────────────────────────────────────────────────

async function _persistQueue(): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(_queue));
  } catch {
    // Storage write failure — in-memory queue still works for the session.
  }
}

async function _loadQueue(): Promise<void> {
  if (_loaded) return;
  try {
    const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as QueueItem[];
      // Validate shape and discard corrupted entries.
      _queue = parsed.filter(
        (item) =>
          item &&
          typeof item.id === "string" &&
          typeof item.action?.type === "string" &&
          typeof item.attempts === "number",
      );
    }
  } catch {
    _queue = [];
  }
  _loaded = true;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Load the persisted queue from storage. Call once at app startup.
 */
export async function initOfflineQueue(): Promise<void> {
  await _loadQueue();
}

/**
 * Add an action to the queue.
 * Safe to call even when online — the queue is just a buffer; it'll be
 * drained immediately if connectivity is available.
 */
export async function enqueueAction(action: QueuedAction): Promise<string> {
  await _loadQueue();

  // Deduplicate TOGGLE_SAVE for the same listing (last write wins).
  if (action.type === "TOGGLE_SAVE") {
    const { listingId } = (action as ToggleSaveAction).payload;
    _queue = _queue.filter(
      (item) =>
        item.action.type !== "TOGGLE_SAVE" ||
        (item.action as ToggleSaveAction).payload.listingId !== listingId,
    );
  }

  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const item: QueueItem = {
    id,
    action,
    createdAt: Date.now(),
    attempts: 0,
    nextRetryAt: 0,
  };

  _queue.push(item);
  await _persistQueue();
  return id;
}

/**
 * Remove a queued item by id (e.g. if the user cancels the action while offline).
 */
export async function dequeueAction(id: string): Promise<void> {
  _queue = _queue.filter((item) => item.id !== id);
  await _persistQueue();
}

/** How many items are currently queued. */
export function getQueueLength(): number {
  return _queue.length;
}

/** Returns a read-only snapshot of the current queue. */
export function getQueueSnapshot(): readonly QueueItem[] {
  return _queue;
}

/**
 * Drain the offline queue.
 * Should be called whenever internet connectivity is (re)established.
 *
 * - Processes items in FIFO order.
 * - Skips items that are within their back-off window.
 * - On success: removes item from queue.
 * - On failure: increments attempts + schedules next retry.
 * - Items that hit MAX_RETRIES are dropped (logged to console).
 */
export async function drainOfflineQueue(): Promise<{ synced: number; failed: number }> {
  if (_draining) return { synced: 0, failed: 0 };
  _draining = true;

  await _loadQueue();

  let synced = 0;
  let failed = 0;
  const now = Date.now();
  const remaining: QueueItem[] = [];

  for (const item of _queue) {
    // Skip items still in their back-off window.
    if (item.nextRetryAt > now) {
      remaining.push(item);
      continue;
    }

    const executor = executors.get(item.action.type);

    if (!executor) {
      // No executor registered — keep in queue (might be registered later).
      remaining.push(item);
      continue;
    }

    try {
      await executor(item);
      synced++;
      // Do NOT push to remaining — item is consumed.
    } catch (error) {
      const newAttempts = item.attempts + 1;
      if (newAttempts >= MAX_RETRIES) {
        failed++;
        // Drop permanently after max retries.
        console.warn(
          `[OfflineQueue] Dropping item ${item.id} (type=${item.action.type}) after ${MAX_RETRIES} attempts.`,
          error,
        );
      } else {
        remaining.push({
          ...item,
          attempts: newAttempts,
          nextRetryAt: now + retryDelay(newAttempts),
          lastError: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  _queue = remaining;
  _draining = false;
  await _persistQueue();

  if (synced > 0 || failed > 0) {
    console.info(`[OfflineQueue] Drain complete — synced: ${synced}, failed: ${failed}, remaining: ${remaining.length}`);
  }

  return { synced, failed };
}

/**
 * Clear the entire queue (e.g. on logout).
 */
export async function clearOfflineQueue(): Promise<void> {
  _queue = [];
  await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
}
