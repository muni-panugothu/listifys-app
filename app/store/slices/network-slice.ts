import { type PayloadAction, createSlice } from "@reduxjs/toolkit";

export type ConnectionType =
  | "unknown"
  | "none"
  | "wifi"
  | "cellular"
  | "bluetooth"
  | "ethernet"
  | "wimax"
  | "vpn"
  | "other";

export type CellularGeneration = "2g" | "3g" | "4g" | "5g" | null;

type NetworkState = {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  isSlowConnection: boolean;
  transportIsSlow: boolean;
  requestIsSlow: boolean;
  connectionType: ConnectionType;
  cellularGeneration: CellularGeneration;
  isConnectionExpensive: boolean;
  lastStatusChangeAt: string | null;
  lastSlowRequestAt: string | null;
  lastSlowRequestDurationMs: number | null;
};

type NetworkSnapshot = {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  transportIsSlow: boolean;
  connectionType: ConnectionType;
  cellularGeneration: CellularGeneration;
  isConnectionExpensive: boolean;
};

const initialState: NetworkState = {
  isConnected: true,
  isInternetReachable: null,
  isSlowConnection: false,
  transportIsSlow: false,
  requestIsSlow: false,
  connectionType: "unknown",
  cellularGeneration: null,
  isConnectionExpensive: false,
  lastStatusChangeAt: null,
  lastSlowRequestAt: null,
  lastSlowRequestDurationMs: null,
};

const networkSlice = createSlice({
  name: "network",
  initialState,
  reducers: {
    updateNetworkSnapshot(state, action: PayloadAction<NetworkSnapshot>) {
      const next = action.payload;
      const didConnectionStateChange =
        state.isConnected !== next.isConnected ||
        state.isInternetReachable !== next.isInternetReachable ||
        state.connectionType !== next.connectionType ||
        state.cellularGeneration !== next.cellularGeneration ||
        state.isConnectionExpensive !== next.isConnectionExpensive ||
        state.transportIsSlow !== next.transportIsSlow;

      state.isConnected = next.isConnected;
      state.isInternetReachable = next.isInternetReachable;
      state.transportIsSlow = next.transportIsSlow;
      state.isSlowConnection = next.transportIsSlow || state.requestIsSlow;
      state.connectionType = next.connectionType;
      state.cellularGeneration = next.cellularGeneration;
      state.isConnectionExpensive = next.isConnectionExpensive;

      if (didConnectionStateChange) {
        state.lastStatusChangeAt = new Date().toISOString();
      }
    },
    reportSlowRequest(state, action: PayloadAction<number>) {
      state.requestIsSlow = true;
      state.isSlowConnection = true;
      state.lastSlowRequestAt = new Date().toISOString();
      state.lastSlowRequestDurationMs = action.payload;
      state.lastStatusChangeAt = new Date().toISOString();
    },
    clearSlowRequestSignal(state) {
      state.requestIsSlow = false;
      state.isSlowConnection = state.transportIsSlow;
      state.lastSlowRequestAt = null;
      state.lastSlowRequestDurationMs = null;
      state.lastStatusChangeAt = new Date().toISOString();
    },
  },
});

export const {
  clearSlowRequestSignal,
  reportSlowRequest,
  updateNetworkSnapshot,
} = networkSlice.actions;

export default networkSlice.reducer;