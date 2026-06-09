import { createAsyncThunk, createSelector, createSlice } from "@reduxjs/toolkit";

import {
  detectDeviceLocation,
  geocodeSearchQuery,
  hasLocationPermission,
  loadStoredLocation,
  LOCATION_AUTO_REFRESH_MS,
  requestLocationPermission,
  saveStoredLocation,
  type StoredAppLocation,
} from "@/lib/location-service";

import type { RootState } from "../index";

export type LocationSource = "gps" | "manual" | "profile" | null;

type LocationState = {
  label: string;
  lat: number | null;
  lng: number | null;
  /** ISO 3166-1 alpha-2 country code, e.g. "IN", "US", "GB". */
  isoCountryCode: string | null;
  source: LocationSource;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  hydrated: boolean;
};

const initialState: LocationState = {
  label: "Set location",
  lat: null,
  lng: null,
  isoCountryCode: null,
  source: null,
  status: "idle",
  error: null,
  hydrated: false,
};

function applyStored(state: LocationState, stored: StoredAppLocation) {
  state.label = stored.label;
  state.lat = stored.lat;
  state.lng = stored.lng;
  state.isoCountryCode = stored.isoCountryCode ?? null;
  state.source = stored.source;
  state.status = "ready";
  state.error = null;
}

export const hydrateAppLocation = createAsyncThunk(
  "location/hydrate",
  async (_, { getState }) => {
    const stored = await loadStoredLocation();
    if (stored) return stored;

    const user = (getState() as RootState).auth.user;
    const profileAddress = user?.address?.trim();
    if (profileAddress) {
      return {
        label: profileAddress,
        lat: null,
        lng: null,
        source: "profile" as const,
      };
    }

    return null;
  },
);

export const refreshDeviceLocation = createAsyncThunk(
  "location/refreshDevice",
  async (options: { force?: boolean } | undefined, { getState, rejectWithValue }) => {
    try {
      const stored = await loadStoredLocation();
      const force = options?.force === true;

      // Never auto-override a user's manually chosen location with GPS
      if (!force && stored?.source === "manual") {
        return stored;
      }

      if (
        !force &&
        stored?.source === "gps" &&
        stored.updatedAt &&
        Date.now() - stored.updatedAt < LOCATION_AUTO_REFRESH_MS
      ) {
        return stored;
      }

      let permitted = await hasLocationPermission();
      if (!permitted && (force || !stored)) {
        permitted = await requestLocationPermission();
      }
      if (!permitted) {
        return rejectWithValue("PERMISSION_DENIED");
      }

      const loc = (getState() as RootState).location;
      const previous: StoredAppLocation | null =
        stored ??
        (loc.lat != null && loc.lng != null
          ? {
              label: loc.label,
              lat: loc.lat,
              lng: loc.lng,
              isoCountryCode: loc.isoCountryCode,
              source: "gps",
              updatedAt: 0,
            }
          : null);

      return await detectDeviceLocation({ previous, force });
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Could not detect location",
      );
    }
  },
);

export const setLocationFromSearch = createAsyncThunk(
  "location/setFromSearch",
  async (query: string, { rejectWithValue }) => {
    try {
      const result = await geocodeSearchQuery(query);
      const stored: StoredAppLocation = {
        label: result.label,
        lat: result.lat,
        lng: result.lng,
        isoCountryCode: result.isoCountryCode ?? null,
        source: "manual",
        updatedAt: Date.now(),
      };
      await saveStoredLocation(stored);
      return stored;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Could not find location",
      );
    }
  },
);

export const useCurrentDeviceLocation = createAsyncThunk(
  "location/useCurrent",
  async (_, { getState, rejectWithValue }) => {
    try {
      let permitted = await hasLocationPermission();
      if (!permitted) {
        permitted = await requestLocationPermission();
      }
      if (!permitted) {
        return rejectWithValue("PERMISSION_DENIED");
      }

      const stored = await loadStoredLocation();
      const loc = (getState() as RootState).location;
      const previous: StoredAppLocation | null =
        stored ??
        (loc.lat != null && loc.lng != null
          ? {
              label: loc.label,
              lat: loc.lat,
              lng: loc.lng,
              isoCountryCode: loc.isoCountryCode,
              source: loc.source === "manual" ? "manual" : "gps",
              updatedAt: 0,
            }
          : null);

      return await detectDeviceLocation({ previous, force: true });
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Could not get current location",
      );
    }
  },
);

const locationSlice = createSlice({
  name: "location",
  initialState,
  reducers: {
    setProfileFallbackLocation(state, action: { payload: string }) {
      const address = action.payload.trim();
      if (!address) return;
      if (state.source === "gps" || state.source === "manual") return;
      if (state.lat != null && state.lng != null) return;

      state.label = address;
      state.source = "profile";
      state.status = "ready";
    },
    /** Directly set location from an autocomplete selection (no async needed). */
    setLocationDirect(
      state,
      action: {
        payload: {
          label: string;
          lat: number;
          lng: number;
          isoCountryCode?: string | null;
        };
      },
    ) {
      state.label = action.payload.label;
      state.lat = action.payload.lat;
      state.lng = action.payload.lng;
      if (action.payload.isoCountryCode !== undefined) {
        state.isoCountryCode = action.payload.isoCountryCode;
      }
      state.source = "manual";
      state.status = "ready";
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(hydrateAppLocation.pending, (state) => {
        state.status = "loading";
      })
      .addCase(hydrateAppLocation.fulfilled, (state, action) => {
        state.hydrated = true;
        const payload = action.payload;
        if (payload && "lat" in payload && payload.lat != null) {
          applyStored(state, payload as StoredAppLocation);
        } else if (payload && "label" in payload) {
          state.label = payload.label;
          state.lat = null;
          state.lng = null;
          state.source = payload.source ?? "profile";
          state.status = "ready";
          state.error = null;
        } else {
          state.status = "ready";
        }
      })
      .addCase(hydrateAppLocation.rejected, (state) => {
        state.hydrated = true;
        state.status = "ready";
      })

      .addCase(refreshDeviceLocation.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(refreshDeviceLocation.fulfilled, (state, action) => {
        applyStored(state, action.payload);
      })
      .addCase(refreshDeviceLocation.rejected, (state, action) => {
        state.status = state.lat != null ? "ready" : "error";
        state.error = (action.payload as string) ?? "Location unavailable";
      })

      .addCase(setLocationFromSearch.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(setLocationFromSearch.fulfilled, (state, action) => {
        applyStored(state, action.payload);
      })
      .addCase(setLocationFromSearch.rejected, (state, action) => {
        state.status = state.lat != null ? "ready" : "error";
        state.error = (action.payload as string) ?? "Search failed";
      })

      .addCase(useCurrentDeviceLocation.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(useCurrentDeviceLocation.fulfilled, (state, action) => {
        applyStored(state, action.payload);
      })
      .addCase(useCurrentDeviceLocation.rejected, (state, action) => {
        state.status = state.lat != null ? "ready" : "error";
        state.error = (action.payload as string) ?? "Location unavailable";
      })
      // When user logs out, wipe their location so a guest/new login
      // starts fresh with no location filter (shows all-countries data).
      .addMatcher(
        (action) => action.type === "auth/logout/fulfilled",
        (state) => {
          state.label = initialState.label;
          state.lat = initialState.lat;
          state.lng = initialState.lng;
          state.isoCountryCode = initialState.isoCountryCode;
          state.source = initialState.source;
          state.status = initialState.status;
          state.error = initialState.error;
          state.hydrated = false;
        },
      );
  },
});

export const { setProfileFallbackLocation, setLocationDirect } = locationSlice.actions;

export const selectLocationLabel = (state: RootState) => {
  if (state.location.status === "loading" && !state.location.hydrated) {
    return "Detecting location…";
  }
  return state.location.label;
};

export const selectLocationCoords = createSelector(
  (state: RootState) => state.location.lat,
  (state: RootState) => state.location.lng,
  (state: RootState) => state.location.label,
  (state: RootState) => state.location.isoCountryCode,
  (lat, lng, label, isoCountryCode) => ({ lat, lng, label, isoCountryCode }),
);

export const selectIsoCountryCode = (state: RootState) =>
  state.location.isoCountryCode;

export const selectLocationSource = (state: RootState) =>
  state.location.source;

/** Distance on cards is shown only after the user explicitly picks a location. */
export const selectCanShowDistanceOnCards = (state: RootState) =>
  state.location.source === "manual" &&
  state.location.lat != null &&
  state.location.lng != null;

export default locationSlice.reducer;
