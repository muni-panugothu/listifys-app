import { configureStore } from "@reduxjs/toolkit";

import authReducer from "./slices/auth-slice";
<<<<<<< HEAD
import networkReducer from "./slices/network-slice";
=======
import authGateReducer from "./slices/auth-gate-slice";
>>>>>>> 6bb5ad6d92f5b6fc7fe22622c4af17bc56e61087
import onboardingReducer from "./slices/onboarding-slice";
import postFormReducer from "./slices/post-form-slice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
<<<<<<< HEAD
    network: networkReducer,
=======
    authGate: authGateReducer,
>>>>>>> 6bb5ad6d92f5b6fc7fe22622c4af17bc56e61087
    onboarding: onboardingReducer,
    postForm: postFormReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
