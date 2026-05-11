import { type PayloadAction, createSlice } from "@reduxjs/toolkit";

export type AuthGateAction = "save" | "message" | "offer" | "general" | "sell" | "profile";

type AuthGateState = {
  visible: boolean;
  action: AuthGateAction;
  redirectTo: string | null;
};

const initialState: AuthGateState = {
  visible: false,
  action: "general",
  redirectTo: null,
};

const authGateSlice = createSlice({
  name: "authGate",
  initialState,
  reducers: {
    showAuthGate: (
      state,
      action: PayloadAction<{ action?: AuthGateAction; redirectTo?: string | null } | undefined>,
    ) => {
      state.visible = true;
      state.action = action.payload?.action ?? "general";
      state.redirectTo = action.payload?.redirectTo ?? null;
    },
    hideAuthGate: (state) => {
      state.visible = false;
      state.action = "general";
      state.redirectTo = null;
    },
  },
});

export const { showAuthGate, hideAuthGate } = authGateSlice.actions;
export default authGateSlice.reducer;