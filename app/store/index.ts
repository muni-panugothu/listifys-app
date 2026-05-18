import { configureStore } from "@reduxjs/toolkit";

import authReducer from "./slices/auth-slice";
import authGateReducer from "./slices/auth-gate-slice";
import networkReducer from "./slices/network-slice";
import onboardingReducer from "./slices/onboarding-slice";
import locationReducer from "./slices/location-slice";
import postFormReducer from "./slices/post-form-slice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    authGate: authGateReducer,
    location: locationReducer,
    network: networkReducer,
    onboarding: onboardingReducer,
    postForm: postFormReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;