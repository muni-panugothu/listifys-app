import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

const ONBOARDING_KEY = "@listify/onboarding_complete";

type OnboardingState = {
  hasCompletedOnboarding: boolean | null; // null = not yet loaded
};

const initialState: OnboardingState = {
  hasCompletedOnboarding: null,
};

export const checkOnboarding = createAsyncThunk(
  "onboarding/check",
  async () => {
    const value = await AsyncStorage.getItem(ONBOARDING_KEY);
    return value === "true";
  },
);

export const completeOnboarding = createAsyncThunk(
  "onboarding/complete",
  async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    return true;
  },
);

const onboardingSlice = createSlice({
  name: "onboarding",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(checkOnboarding.fulfilled, (state, action) => {
        state.hasCompletedOnboarding = action.payload;
      })
      .addCase(checkOnboarding.rejected, (state) => {
        // If storage read fails, treat as first-time user for safer UX.
        state.hasCompletedOnboarding = false;
      })
      .addCase(completeOnboarding.fulfilled, (state) => {
        state.hasCompletedOnboarding = true;
      });
  },
});

export default onboardingSlice.reducer;
