/**
 * usePlacesAutocomplete
 *
 * Manages Google Places Autocomplete state with:
 * - 300ms debounce
 * - AbortController per request (cancels in-flight on fast typing)
 * - Billing session token lifecycle
 * - Recent locations loading
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchAutocompletePredictions,
  generateSessionToken,
  loadRecentLocations,
  type PlacePrediction,
  type RecentLocation,
} from "@/lib/google-places.service";

const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;

export type PlacesAutocompleteState = {
  predictions: PlacePrediction[];
  recentLocations: RecentLocation[];
  loading: boolean;
  error: string | null;
  /**
   * Current billing session token.
   * Pass this to both autocomplete calls AND the Place Details call
   * that completes the selection. Then call resetSession() to start fresh.
   */
  sessionToken: string;
  /** Call after a place is selected (Place Details called). Rotates session token. */
  resetSession: () => void;
  /** Re-loads recent searches from AsyncStorage (call after saving a new one). */
  refreshRecent: () => void;
};

export function usePlacesAutocomplete(
  query: string,
  userLat?: number | null,
  userLng?: number | null,
): PlacesAutocompleteState {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [recentLocations, setRecentLocations] = useState<RecentLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string>(generateSessionToken);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const latestQueryRef = useRef<string>("");

  // Load recent locations on mount
  useEffect(() => {
    loadRecentLocations()
      .then(setRecentLocations)
      .catch(() => {});
  }, []);

  // Debounced autocomplete fetch
  useEffect(() => {
    // Cancel pending debounce + abort in-flight request
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
    abortRef.current = null;

    const trimmed = query.trim();

    if (trimmed.length < MIN_CHARS) {
      setPredictions([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    latestQueryRef.current = trimmed;

    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;

      fetchAutocompletePredictions(
        trimmed,
        sessionToken,
        controller.signal,
        userLat,
        userLng,
      )
        .then((results) => {
          if (latestQueryRef.current !== trimmed) return;
          setPredictions(results);
          setError(null);
        })
        .catch((err: unknown) => {
          const isAbort =
            err instanceof Error &&
            (err.name === "AbortError" || err.message.includes("abort"));
          if (isAbort) return;
          if (latestQueryRef.current !== trimmed) return;
          setError("Could not load suggestions. Check your connection.");
          setPredictions([]);
        })
        .finally(() => {
          if (latestQueryRef.current === trimmed) {
            setLoading(false);
          }
        });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, sessionToken, userLat, userLng]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const resetSession = useCallback(() => {
    setSessionToken(generateSessionToken());
    setPredictions([]);
    setError(null);
    setLoading(false);
  }, []);

  const refreshRecent = useCallback(() => {
    loadRecentLocations()
      .then(setRecentLocations)
      .catch(() => {});
  }, []);

  return {
    predictions,
    recentLocations,
    loading,
    error,
    sessionToken,
    resetSession,
    refreshRecent,
  };
}
