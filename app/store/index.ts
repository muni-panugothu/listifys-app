import { configureStore } from "@reduxjs/toolkit";

import authReducer from "./slices/auth-slice";
import onboardingReducer from "./slices/onboarding-slice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    onboarding: onboardingReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
