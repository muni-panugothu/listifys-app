import AsyncStorage from "@react-native-async-storage/async-storage";
import { type PayloadAction, createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import {
  type AuthUser,
  clearTokens,
  getAuthErrorMessage,
  getAccessToken,
  getProfile,
  getRefreshToken,
  logoutFromServer,
  initiateForgotPassword,
  sendPhoneOtp as sendPhoneOtpRequest,
  initiateRegistration,
  loginWithGoogleToken,
  loginWithPassword,
  resendForgotPasswordOtp,
  resendRegistrationOtp,
  resetPasswordWithToken,
  refreshAccessToken,
  restoreTokens,
  resolveAbsoluteMediaUrl,
  setTokens,
  updateProfile as updateProfileApi,
  verifyPhoneOtp as verifyPhoneOtpRequest,
  verifyForgotPasswordOtp,
  verifyRegistrationOtp,
} from "@/features/auth/services/auth-api";

const USER_STORAGE_KEY = "@listify/auth_user";
const FLOW_STATE_KEY = "@listify/auth_flow_state";

export type AuthStatus = "idle" | "loading" | "succeeded" | "failed";

type AuthState = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  sessionHydrated: boolean;
  status: AuthStatus;
  error: string | null;
  // Registration flow
  registrationEmail: string | null;
  registrationPhone: string | null;
  // Forgot password flow
  resetEmail: string | null;
  resetToken: string | null;
};

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  sessionHydrated: false,
  status: "idle",
  error: null,
  registrationEmail: null,
  registrationPhone: null,
  resetEmail: null,
  resetToken: null,
};

const normalizeStoredUser = (user: AuthUser | null): AuthUser | null => {
  if (!user) return null;
  return {
    ...user,
    avatar: resolveAbsoluteMediaUrl(user.avatar),
    profileImage: resolveAbsoluteMediaUrl(user.profileImage),
    googleProfileImage: resolveAbsoluteMediaUrl(user.googleProfileImage),
    profileImageUrl: resolveAbsoluteMediaUrl(user.profileImageUrl),
  };
};

// ── Thunks ──────────────────────────────────────────────────────────────────────

export const login = createAsyncThunk(
  "auth/login",
  async (
    { identity, password }: { identity: string; password: string },
    { rejectWithValue },
  ) => {
    try {
      const response = await loginWithPassword(identity, password);
      if (!response.accessToken) {
        return rejectWithValue("Sign in succeeded but no session token was returned.");
      }
      if (response.user) {
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.user));
      }
      await setTokens(response.accessToken, response.refreshToken);
      return response;
    } catch (error) {
      return rejectWithValue(getAuthErrorMessage(error));
    }
  },
);

export const googleLogin = createAsyncThunk(
  "auth/googleLogin",
  async ({ idToken }: { idToken: string }, { rejectWithValue }) => {
    try {
      const response = await loginWithGoogleToken(idToken);
      if (!response.accessToken) {
        return rejectWithValue("Google sign in succeeded but no session token was returned.");
      }
      if (response.user) {
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.user));
      }
      await setTokens(response.accessToken, response.refreshToken);
      return response;
    } catch (error) {
      return rejectWithValue(getAuthErrorMessage(error));
    }
  },
);

export const register = createAsyncThunk(
  "auth/register",
  async (
    { name, email, password }: { name: string; email: string; password: string },
    { rejectWithValue },
  ) => {
    try {
      const response = await initiateRegistration(name, email, password);
      return { ...response, email };
    } catch (error) {
      return rejectWithValue(getAuthErrorMessage(error));
    }
  },
);

export const verifyOtp = createAsyncThunk(
  "auth/verifyOtp",
  async (
    { email, otp }: { email: string; otp: string },
    { rejectWithValue },
  ) => {
    try {
      const response = await verifyRegistrationOtp(email, otp);
      if (!response.accessToken) {
        return rejectWithValue("Verification succeeded but no session token was returned.");
      }
      if (response.user) {
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.user));
      }
      await setTokens(response.accessToken, response.refreshToken);
      return response;
    } catch (error) {
      return rejectWithValue(getAuthErrorMessage(error));
    }
  },
);

export const sendPhoneOtp = createAsyncThunk(
  "auth/sendPhoneOtp",
  async (
    { phone, channel = "sms" }: { phone: string; channel?: "sms" | "whatsapp" },
    { rejectWithValue },
  ) => {
    try {
      const response = await sendPhoneOtpRequest(phone, channel);
      return { ...response, phone };
    } catch (error) {
      return rejectWithValue(getAuthErrorMessage(error));
    }
  },
);

export const verifyPhoneOtp = createAsyncThunk(
  "auth/verifyPhoneOtp",
  async (
    { phone, otp, name }: { phone: string; otp: string; name?: string },
    { rejectWithValue },
  ) => {
    try {
      const response = await verifyPhoneOtpRequest(phone, otp, name);
      if (!response.accessToken) {
        return rejectWithValue("Verification succeeded but no session token was returned.");
      }
      if (response.user) {
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.user));
      }
      await setTokens(response.accessToken, response.refreshToken);
      return response;
    } catch (error) {
      return rejectWithValue(getAuthErrorMessage(error));
    }
  },
);

export const resendOtp = createAsyncThunk(
  "auth/resendOtp",
  async ({ email }: { email: string }, { rejectWithValue }) => {
    try {
      return await resendRegistrationOtp(email);
    } catch (error) {
      return rejectWithValue(getAuthErrorMessage(error));
    }
  },
);

export const forgotPassword = createAsyncThunk(
  "auth/forgotPassword",
  async ({ email }: { email: string }, { rejectWithValue }) => {
    try {
      const response = await initiateForgotPassword(email);
      return { ...response, email };
    } catch (error) {
      return rejectWithValue(getAuthErrorMessage(error));
    }
  },
);

export const verifyResetOtp = createAsyncThunk(
  "auth/verifyResetOtp",
  async (
    { email, otp }: { email: string; otp: string },
    { rejectWithValue },
  ) => {
    try {
      return await verifyForgotPasswordOtp(email, otp);
    } catch (error) {
      return rejectWithValue(getAuthErrorMessage(error));
    }
  },
);

export const resendResetOtp = createAsyncThunk(
  "auth/resendResetOtp",
  async ({ email }: { email: string }, { rejectWithValue }) => {
    try {
      return await resendForgotPasswordOtp(email);
    } catch (error) {
      return rejectWithValue(getAuthErrorMessage(error));
    }
  },
);

export const resetPassword = createAsyncThunk(
  "auth/resetPassword",
  async (
    { resetToken, password, email }: { resetToken: string; password: string; email: string },
    { rejectWithValue },
  ) => {
    try {
      return await resetPasswordWithToken(resetToken, password, email);
    } catch (error) {
      return rejectWithValue(getAuthErrorMessage(error));
    }
  },
);

export const restoreSession = createAsyncThunk(
  "auth/restoreSession",
  async () => {
    await restoreTokens();
    const [json, flowJson] = await Promise.all([
      AsyncStorage.getItem(USER_STORAGE_KEY),
      AsyncStorage.getItem(FLOW_STATE_KEY),
    ]);

    const flow = flowJson
      ? (JSON.parse(flowJson) as {
          registrationEmail?: string;
          registrationPhone?: string;
          resetEmail?: string;
          resetToken?: string;
        })
      : null;

    const cachedUser = json ? normalizeStoredUser(JSON.parse(json) as AuthUser) : null;
    const hasTokens = Boolean(getAccessToken() || getRefreshToken());

    if (!hasTokens) {
      if (cachedUser) {
        await AsyncStorage.removeItem(USER_STORAGE_KEY);
      }
      return { user: null, flow, isAuthenticated: false };
    }

    const loadProfile = async () => {
      const profile = await getProfile();
      if (profile.user) {
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(profile.user));
        return profile.user;
      }
      return null;
    };

    try {
      const liveUser = await loadProfile();
      if (liveUser) {
        return { user: liveUser, flow, isAuthenticated: true };
      }
    } catch {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        try {
          const liveUser = await loadProfile();
          if (liveUser) {
            return { user: liveUser, flow, isAuthenticated: true };
          }
        } catch {
          // Fall through to cached session below.
        }
      }
    }

    if (cachedUser) {
      // Both access and refresh tokens are expired. Clear them so future API
      // calls don't send stale auth headers, and the socket won't try to
      // connect with an expired token.
      console.warn('[Auth] Session restore: tokens expired, using cached user. Re-login required for full access.');
      await clearTokens();
      return { user: cachedUser, flow, isAuthenticated: true };
    }

    // No valid session and no cached user — force re-login.
    return { user: null, flow, isAuthenticated: false };
  },
);

export const fetchProfile = createAsyncThunk(
  "auth/fetchProfile",
  async (_, { rejectWithValue }) => {
    try {
      const response = await getProfile();
      if (response.user) {
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.user));
      }
      return response;
    } catch (error) {
      return rejectWithValue(getAuthErrorMessage(error));
    }
  },
);

export const updateUserProfile = createAsyncThunk(
  "auth/updateUserProfile",
  async (
    data: { name?: string; email?: string; phone?: string; address?: string; bio?: string; dateOfBirth?: string; gender?: string },
    { rejectWithValue },
  ) => {
    try {
      const response = await updateProfileApi(data);
      if (response.user) {
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.user));
      }
      return response;
    } catch (error) {
      return rejectWithValue(getAuthErrorMessage(error));
    }
  },
);

export const logout = createAsyncThunk("auth/logout", async () => {
  const { disconnectSocket } = await import("@/features/messaging/services/socket-service");
  disconnectSocket();

  try {
    if (getAccessToken() || getRefreshToken()) {
      await logoutFromServer();
    }
  } catch {
    // Still clear local session if server logout fails (offline, expired token, etc.)
  } finally {
    await AsyncStorage.removeItem(USER_STORAGE_KEY);
    await AsyncStorage.removeItem(FLOW_STATE_KEY);
    await clearTokens();
  }
});

// ── Slice ───────────────────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
    resetAuthStatus(state) {
      if (state.status !== "succeeded") {
        state.status = "idle";
      }
      state.error = null;
    },
    setAuthUser(state, action: PayloadAction<AuthUser | null>) {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
    },
    clearResetFlow(state) {
      state.resetEmail = null;
      state.resetToken = null;
      AsyncStorage.removeItem(FLOW_STATE_KEY);
    },
    clearRegistrationEmail(state) {
      state.registrationEmail = null;
      state.registrationPhone = null;
      state.status = "idle";
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Login
    builder
      .addCase(login.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload.user ?? null;
        state.isAuthenticated = true;
        state.sessionHydrated = true;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload as string;
      });

    // Google Login
    builder
      .addCase(googleLogin.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(googleLogin.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload.user ?? null;
        state.isAuthenticated = true;
        state.sessionHydrated = true;
        state.error = null;
      })
      .addCase(googleLogin.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload as string;
      });

    // Register (initiate)
    builder
      .addCase(register.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.registrationEmail = action.payload.email ?? null;
        state.registrationPhone = null;
        state.error = null;
        AsyncStorage.setItem(FLOW_STATE_KEY, JSON.stringify({ registrationEmail: action.payload.email }));
      })
      .addCase(register.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload as string;
      });

    // Verify OTP (registration complete)
    builder
      .addCase(verifyOtp.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(verifyOtp.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload.user ?? null;
        state.isAuthenticated = true;
        state.sessionHydrated = true;
        state.registrationEmail = null;
        state.registrationPhone = null;
        state.error = null;
        AsyncStorage.removeItem(FLOW_STATE_KEY);
      })
      .addCase(verifyOtp.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload as string;
      });

    // Phone OTP send
    builder
      .addCase(sendPhoneOtp.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(sendPhoneOtp.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.registrationPhone = action.payload.phone ?? null;
        state.registrationEmail = null;
        state.error = null;
        AsyncStorage.setItem(FLOW_STATE_KEY, JSON.stringify({ registrationPhone: action.payload.phone }));
      })
      .addCase(sendPhoneOtp.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload as string;
      });

    // Phone OTP verify
    builder
      .addCase(verifyPhoneOtp.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(verifyPhoneOtp.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload.user ?? null;
        state.isAuthenticated = true;
        state.sessionHydrated = true;
        state.registrationPhone = null;
        state.registrationEmail = null;
        state.error = null;
        AsyncStorage.removeItem(FLOW_STATE_KEY);
      })
      .addCase(verifyPhoneOtp.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload as string;
      });

    // Forgot password
    builder
      .addCase(forgotPassword.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(forgotPassword.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.resetEmail = action.payload.email ?? null;
        state.error = null;
        AsyncStorage.setItem(FLOW_STATE_KEY, JSON.stringify({ resetEmail: action.payload.email }));
      })
      .addCase(forgotPassword.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload as string;
      });

    // Verify Reset OTP
    builder
      .addCase(verifyResetOtp.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(verifyResetOtp.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.resetToken = action.payload.resetToken ?? null;
        state.error = null;
        AsyncStorage.setItem(FLOW_STATE_KEY, JSON.stringify({ resetEmail: state.resetEmail, resetToken: action.payload.resetToken }));
      })
      .addCase(verifyResetOtp.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload as string;
      });

    // Reset Password
    builder
      .addCase(resetPassword.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(resetPassword.fulfilled, (state) => {
        state.status = "succeeded";
        state.resetEmail = null;
        state.resetToken = null;
        state.error = null;
        AsyncStorage.removeItem(FLOW_STATE_KEY);
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload as string;
      });

    // Restore session
    builder
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.isAuthenticated = action.payload.isAuthenticated;
        state.sessionHydrated = true;
        if (action.payload.flow) {
          state.registrationEmail = action.payload.flow.registrationEmail ?? null;
          state.registrationPhone = action.payload.flow.registrationPhone ?? null;
          state.resetEmail = action.payload.flow.resetEmail ?? null;
          state.resetToken = action.payload.flow.resetToken ?? null;
        }
      })
      .addCase(restoreSession.rejected, (state) => {
        state.sessionHydrated = true;
        state.isAuthenticated = false;
        state.user = null;
      });

    // Fetch profile
    builder
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.user = action.payload.user ?? state.user;
      });

    // Update profile
    builder
      .addCase(updateUserProfile.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload.user ?? state.user;
        state.error = null;
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload as string;
      });

    // Logout
    builder.addCase(logout.fulfilled, (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.sessionHydrated = true;
      state.status = "idle";
      state.error = null;
      state.registrationEmail = null;
      state.registrationPhone = null;
      state.resetEmail = null;
      state.resetToken = null;
    });
  },
});

export const { clearError, resetAuthStatus, setAuthUser, clearResetFlow, clearRegistrationEmail } =
  authSlice.actions;
export default authSlice.reducer;
