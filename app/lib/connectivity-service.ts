/**
 * ConnectivityService
 *
 * True internet reachability validation that goes beyond NetInfo's
 * `isInternetReachable` (which can return `null` on Android and reports
 * only layer-2 connectivity, not actual internet access).
 *
 * Strategy (first success wins, all run in parallel):
 *   1. Backend health endpoint — validates app-server reachability
 *   2. Cloudflare DNS-over-HTTPS (1.1.1.1) — lightweight, always fast
 *   3. Google connectivity check — canonical captive-portal probe
 *
 * Edge cases handled:
 *   - WiFi connected but no internet (captive portal, ISP block)
 *   - VPN connected with broken routing
 *   - Server unreachable but internet works (app-specific outage)
 *   - Airplane mode toggle
 *   - Rapid connect/disconnect (debounced)
 */

import { AUTH_API_BASE_URL } from "@/features/auth/services/auth-api";

const PROBE_TIMEOUT_MS = 4_000;
const DEBOUNCE_MS = 800;

// Cloudflare DNS-over-HTTPS — resolves in <50ms globally.
const CF_PROBE_URL = "https://1.1.1.1/dns-query?name=listify.app&type=A";
// Google's standard captive-portal check endpoint.
const GOOGLE_PROBE_URL = "https://connectivitycheck.gstatic.com/generate_204";

/**
 * Fire-and-forget fetch that resolves true on any HTTP response (incl. 4xx),
 * resolves false only on network error or timeout.
 */
async function probe(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      cache: "no-store",
    });
    // Any HTTP response (including 204, 301, 403 etc.) proves TCP + IP routing works.
    return res.status > 0;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Check if the backend health endpoint is reachable.
 * Validates app-specific connectivity on top of general internet.
 */
async function probeBackend(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${AUTH_API_BASE_URL}/health`, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns true if *any* of the three probes succeeds.
 * Running in parallel means the check resolves as fast as the fastest probe.
 */
export async function checkActualInternetAccess(): Promise<boolean> {
  const [cfOk, googleOk, backendOk] = await Promise.all([
    probe(CF_PROBE_URL),
    probe(GOOGLE_PROBE_URL),
    probeBackend(),
  ]);
  // Any one positive = we have internet. All negative = genuinely offline.
  return cfOk || googleOk || backendOk;
}

/**
 * ConnectivityService
 *
 * Singleton class that manages an asynchronous internet-validation loop.
 * External callers (NetworkStatusLayer) subscribe via `onStatusChange`.
 * Debounces rapid changes to prevent flip-flopping during transition.
 */
class ConnectivityService {
  private _isOnline: boolean = true;
  private _listeners = new Set<(online: boolean) => void>();
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _checkInFlight: boolean = false;

  /** Subscribe to connection state changes. Returns an unsubscribe function. */
  subscribe(listener: (online: boolean) => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  get isOnline(): boolean {
    return this._isOnline;
  }

  /**
   * Called by NetworkStatusLayer when NetInfo reports a change.
   * Debounces rapid events and runs real validation before notifying subscribers.
   */
  handleNetInfoChange(netInfoIsConnected: boolean): void {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }

    // Fast path: when NetInfo says disconnected, trust it immediately (no false positives).
    if (!netInfoIsConnected) {
      this._debounceTimer = setTimeout(() => this._setOnline(false), DEBOUNCE_MS);
      return;
    }

    // Slow path: when NetInfo says connected, validate with real probes.
    // Debounce to avoid hammering probes during rapid WiFi re-associations.
    this._debounceTimer = setTimeout(() => {
      void this._validateAndNotify();
    }, DEBOUNCE_MS);
  }

  private async _validateAndNotify(): Promise<void> {
    if (this._checkInFlight) return;
    this._checkInFlight = true;
    try {
      const online = await checkActualInternetAccess();
      this._setOnline(online);
    } finally {
      this._checkInFlight = false;
    }
  }

  private _setOnline(online: boolean): void {
    if (this._isOnline === online) return;
    this._isOnline = online;
    for (const listener of this._listeners) {
      listener(online);
    }
  }

  destroy(): void {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }
    this._listeners.clear();
  }
}

export const connectivityService = new ConnectivityService();
