import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import {
  detectDeviceLocation,
  geocodeSearchQuery,
  loadStoredLocation,
  saveStoredLocation,
  type StoredAppLocation,
} from "@/lib/location-service";

import type { RootState } from "../index";

export type LocationSource = "gps" | "manual" | "profile" | null;

type LocationState = {
  label: string;
  lat: number | null;
  lng: number | null;
  source: LocationSource;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  hydrated: boolean;
};

const initialState: LocationState = {
  label: "Set location",
  lat: null,
  lng: null,
  source: null,
  status: "idle",
  error: null,
  hydrated: false,
};

function applyStored(state: LocationState, stored: StoredAppLocation) {
  state.label = stored.label;
  state.lat = stored.lat;
  state.lng = stored.lng;
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
  async (_, { rejectWithValue }) => {
    try {
      return await detectDeviceLocation();
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
  async (_, { rejectWithValue }) => {
    try {
      return await detectDeviceLocation();
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
      });
  },
});

export const { setProfileFallbackLocation } = locationSlice.actions;

export const selectLocationLabel = (state: RootState) => {
  if (state.location.status === "loading" && !state.location.hydrated) {
    return "Detecting location…";
  }
  return state.location.label;
};

export const selectLocationCoords = (state: RootState) => ({
  lat: state.location.lat,
  lng: state.location.lng,
  label: state.location.label,
});

export default locationSlice.reducer;
