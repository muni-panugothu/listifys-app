import { configureStore } from "@reduxjs/toolkit";

import authReducer from "./slices/auth-slice";
import authGateReducer from "./slices/auth-gate-slice";
import onboardingReducer from "./slices/onboarding-slice";
import postFormReducer from "./slices/post-form-slice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    authGate: authGateReducer,
    onboarding: onboardingReducer,
    postForm: postFormReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
