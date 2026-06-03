import Constants from "expo-constants";
import {
  readStoredTokens,
  writeStoredTokens,
} from "@/lib/secure-auth-storage";
import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

type ExpoDeviceModule = {
  brand?: string | null;
  modelName?: string | null;
  osName?: string | null;
  osVersion?: string | null;
};

const deviceModule = requireOptionalNativeModule<ExpoDeviceModule>("ExpoDevice");

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role?: string;
  provider?: string;
  hasPassword?: boolean;
  avatar?: string | null;
  profileImage?: string | null;
  googleProfileImage?: string | null;
  profileImageUrl?: string | null;
  isVerified?: boolean;
  phoneVerified?: boolean;
  followersCount?: number;
  followingCount?: number;
  listingsCount?: number;
  createdAt?: string;
  bio?: string | null;
  address?: string | null;
};

export type AuthResponse = {
  success: boolean;
  message?: string;
  user?: AuthUser;
  accessToken?: string;
  refreshToken?: string;
};

export type GoogleClientIds = {
  web: string | null;
  ios: string | null;
  android: string | null;
};

export class AuthApiError extends Error {
  status?: number;
  details?: unknown;

  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
    this.details = details;
  }
}

const API_REQUEST_TIMEOUT_MS = 15_000;

function getExpoDevHost() {
  // expo-dev-client / Expo Go sets hostUri at runtime so the LAN IP is always current.
  // Try all known manifest shapes from oldest (Expo SDK <46) to newest (SDK 46+).
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost ??
    Constants.manifest2?.extra?.expoGo?.debuggerHost ??
    // SDK 46+ packager info
    (Constants.manifest2 as { launchAsset?: unknown; extra?: { expoGo?: { debuggerHost?: string } } } | null)
      ?.extra?.expoGo?.debuggerHost;

  // hostUri is "ip:port" — take only the IP portion before the colon.
  const host = typeof hostUri === "string" ? hostUri.split(":")[0] : undefined;

  // Sanity-check: must be a non-loopback IP (at least one dot, no colon leftovers).
  if (host && host !== "localhost" && host !== "127.0.0.1" && host.includes(".") && !host.includes(":")) {
    return host;
  }
  return undefined;
}

function resolveApiBaseUrl() {
  const devHost = getExpoDevHost();
  const explicitBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

  // In DEV mode, prefer the runtime Metro host over the .env value.
  // Constants.expoConfig.hostUri is set at runtime by the Expo packager to
  // the CURRENT LAN IP — it is always accurate even when the machine's IP
  // changes between sessions, so we never hit a stale baked-in URL.
  if (typeof __DEV__ !== "undefined" && __DEV__ && devHost) {
    return `http://${devHost}:5000`;
  }

  // Outside dev (production build) or when Metro host is unavailable,
  // fall back to the explicit .env override.
  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/$/, "");
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:5000"; // Android emulator loopback to host
  }

  return "http://localhost:5000";
}

export const AUTH_API_BASE_URL = resolveApiBaseUrl();

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = API_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new AuthApiError(
        "The request timed out. Please check your internet connection and try again.",
        0,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function toAbsoluteUrl(url?: string | null) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url) || url.startsWith("data:") || url.startsWith("file:")) {
    return url;
  }
  if (url.startsWith("//")) {
    return `https:${url}`;
  }
  if (url.startsWith("/")) {
    return `${AUTH_API_BASE_URL}${url}`;
  }
  return `${AUTH_API_BASE_URL}/${url}`;
}

export function resolveAbsoluteMediaUrl(url?: string | null) {
  return toAbsoluteUrl(url);
}

function normalizeAuthUser<
  T extends {
    id?: string;
    _id?: string;
    avatar?: string | null;
    profileImage?: string | null;
    googleProfileImage?: string | null;
    profileImageUrl?: string | null;
  },
>(user: T): T & { id?: string } {
  const id = user.id ?? user._id;
  return {
    ...user,
    ...(id != null ? { id: String(id) } : {}),
    avatar: toAbsoluteUrl(user.avatar),
    profileImage: toAbsoluteUrl(user.profileImage),
    googleProfileImage: toAbsoluteUrl(user.googleProfileImage),
    profileImageUrl: toAbsoluteUrl(user.profileImageUrl),
  };
}

// ── Device User-Agent for backend device tracking ───────────────────────────────
// Format: "Listify/VERSION (Brand Model; OS Version)" — must match server Listify UA regex.
// Do NOT add extra words between VERSION and "(" — the server regex expects whitespace only.
function buildUserAgent(): string {
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";
  const brand = deviceModule?.brand;
  const modelName = deviceModule?.modelName;
  const osName = deviceModule?.osName ?? Platform.OS;
  const osVersion = deviceModule?.osVersion ?? Platform.Version?.toString() ?? "";
  // Build device model string — avoid "Unknown Unknown" when device module unavailable
  const deviceModel =
    brand && modelName ? `${brand} ${modelName}` :
    brand ? brand :
    modelName ? modelName :
    "Mobile Device";
  return `Listify/${appVersion} (${deviceModel}; ${osName} ${osVersion})`;
}

const APP_USER_AGENT = buildUserAgent();

// ── Token management (SecureStore + in-memory cache) ───────────────────────────
let _accessToken: string | null = null;
let _refreshToken: string | null = null;
let _refreshPromise: Promise<boolean> | null = null;

export async function setTokens(access: string | null | undefined, refresh: string | null | undefined) {
  const nextAccess = access?.trim() ? access.trim() : null;
  const nextRefresh = refresh?.trim() ? refresh.trim() : null;

  if (!nextAccess && !nextRefresh) {
    return;
  }

  _accessToken = nextAccess;
  _refreshToken = nextRefresh;
  await writeStoredTokens({
    accessToken: _accessToken,
    refreshToken: _refreshToken,
  });
}

export async function restoreTokens() {
  const stored = await readStoredTokens();
  if (stored) {
    _accessToken = stored.accessToken ?? null;
    _refreshToken = stored.refreshToken ?? null;
  }
}

export async function clearTokens() {
  _accessToken = null;
  _refreshToken = null;
  await writeStoredTokens(null);
}

export function getAccessToken() {
  return _accessToken;
}

export function getRefreshToken() {
  return _refreshToken;
}

export function hasStoredSessionTokens() {
  return Boolean(_accessToken || _refreshToken);
}

export async function refreshAccessToken(): Promise<boolean> {
  // Try to restore from storage if in-memory token is missing
  if (!_refreshToken) {
    await restoreTokens();
  }
  if (!_refreshToken) return false;

  // Deduplicate concurrent refresh calls
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      const res = await fetchWithTimeout(`${AUTH_API_BASE_URL}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": APP_USER_AGENT },
        body: JSON.stringify({ refreshToken: _refreshToken }),
      });
      const data = await parseJsonSafe(res);
      if (res.ok && data && typeof data === "object") {
        const body = data as Record<string, unknown>;
        if (body.accessToken) {
          await setTokens(body.accessToken as string, (body.refreshToken as string) ?? _refreshToken);
          return true;
        }
      }
      // Refresh failed — clear tokens so user is redirected to sign-in
      await clearTokens();
      return false;
    } catch {
      return false;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

function extractErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "Request failed. Please try again.";
  }

  const body = payload as Record<string, unknown>;

  const findFirstString = (value: unknown): string | null => {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findFirstString(item);
        if (found) return found;
      }
      return null;
    }
    if (value && typeof value === "object") {
      for (const item of Object.values(value as Record<string, unknown>)) {
        const found = findFirstString(item);
        if (found) return found;
      }
      return null;
    }
    return null;
  };

  // Prefer specific field errors over generic messages like "Validation failed"
  if (body.errors && typeof body.errors === "object") {
    const firstError = findFirstString(body.errors);
    if (firstError) {
      return firstError;
    }
  }

  if (typeof body.message === "string" && body.message.trim().length > 0) {
    return body.message;
  }

  return "Request failed. Please try again.";
}

async function parseJsonSafe(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${AUTH_API_BASE_URL}${normalizedPath}`;

  // Ensure in-memory tokens are loaded from storage before first request
  if (!_accessToken && !_refreshToken) {
    await restoreTokens();
  }

  const buildHeaders = () => ({
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": APP_USER_AGENT,
    ...(_accessToken ? { Authorization: `Bearer ${_accessToken}` } : {}),
    ...(init?.headers ?? {}),
  });

  let response = await fetchWithTimeout(url, {
    ...init,
    credentials: "include",
    headers: buildHeaders(),
  });

  // Auto-refresh on 401 and retry once
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await fetchWithTimeout(url, {
        ...init,
        credentials: "include",
        headers: buildHeaders(),
      });
    }
  }

  const data = await parseJsonSafe(response);

  if (!response.ok) {
    throw new AuthApiError(extractErrorMessage(data), response.status, data);
  }

  if (data && typeof data === "object" && "success" in (data as Record<string, unknown>)) {
    const typedData = data as { success?: boolean };
    if (typedData.success === false) {
      throw new AuthApiError(extractErrorMessage(data), response.status, data);
    }
  }

  return (data ?? {}) as T;
}

export function getAuthErrorMessage(error: unknown) {
  if (error instanceof AuthApiError) {
    if (error.status === 0 || error.message.toLowerCase().includes("network")) {
      return "Unable to connect to the server. Please check your internet connection and try again.";
    }
    return error.message;
  }

  if (error instanceof TypeError) {
    return "Unable to connect to the server. Please check your internet connection and try again.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

export function loginWithPassword(identity: string, password: string) {
  return requestJson<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ identity, password }),
  }).then((response) => ({
    ...response,
    user: response.user ? normalizeAuthUser(response.user) : response.user,
  }));
}

export function initiateRegistration(name: string, email: string, password: string) {
  return requestJson<{ success: boolean; message?: string; email?: string }>(
    "/api/auth/register/initiate",
    {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    },
  );
}

export function verifyRegistrationOtp(email: string, otp: string) {
  return requestJson<AuthResponse>("/api/auth/register/verify", {
    method: "POST",
    body: JSON.stringify({ email, otp }),
  }).then((response) => ({
    ...response,
    user: response.user ? normalizeAuthUser(response.user) : response.user,
  }));
}

export function resendRegistrationOtp(email: string) {
  return requestJson<{ success: boolean; message?: string }>(
    "/api/auth/register/resend-otp",
    {
      method: "POST",
      body: JSON.stringify({ email }),
    },
  );
}

export function sendPhoneOtp(phone: string, channel: "sms" | "whatsapp" = "sms") {
  return requestJson<{ success: boolean; message?: string; phone?: string; channel?: string }>(
    "/api/auth/phone/send-otp",
    {
      method: "POST",
      body: JSON.stringify({ phone, channel }),
    },
  );
}

export function verifyPhoneOtp(phone: string, otp: string, name?: string) {
  return requestJson<AuthResponse & { isNew?: boolean }>("/api/auth/phone/verify-otp", {
    method: "POST",
    body: JSON.stringify({ phone, otp, name }),
  }).then((response) => ({
    ...response,
    user: response.user ? normalizeAuthUser(response.user) : response.user,
  }));
}

export function initiateForgotPassword(email: string) {
  return requestJson<{ success: boolean; message?: string; email?: string }>(
    "/api/auth/forgot-password/initiate",
    {
      method: "POST",
      body: JSON.stringify({ email }),
    },
  );
}

export function verifyForgotPasswordOtp(email: string, otp: string) {
  return requestJson<{ success: boolean; message?: string; resetToken?: string }>(
    "/api/auth/forgot-password/verify-otp",
    {
      method: "POST",
      body: JSON.stringify({ email, otp }),
    },
  );
}

export function resendForgotPasswordOtp(email: string) {
  return requestJson<{ success: boolean; message?: string }>(
    "/api/auth/forgot-password/resend-otp",
    {
      method: "POST",
      body: JSON.stringify({ email }),
    },
  );
}

export function resetPasswordWithToken(resetToken: string, password: string, email: string) {
  return requestJson<{ success: boolean; message?: string }>(
    `/api/auth/reset-password/${encodeURIComponent(resetToken)}`,
    {
      method: "PUT",
      body: JSON.stringify({ email, password }),
    },
  );
}

export async function getGoogleClientIds() {
  const response = await fetch(`${AUTH_API_BASE_URL}/api/auth/google/client-ids`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": APP_USER_AGENT,
    },
  });
  const data = (await parseJsonSafe(response)) as {
    success?: boolean;
    clientIds?: GoogleClientIds;
    message?: string;
  } | null;

  if (!response.ok || !data?.clientIds) {
    throw new AuthApiError(
      extractErrorMessage(data),
      response.status,
      data,
    );
  }

  return data.clientIds;
}

export function loginWithGoogleToken(idToken: string) {
  return requestJson<AuthResponse>("/api/auth/google/token", {
    method: "POST",
    body: JSON.stringify({ idToken }),
  }).then((response) => ({
    ...response,
    user: response.user ? normalizeAuthUser(response.user) : response.user,
  }));
}

// ── Profile APIs ────────────────────────────────────────────────────────────────

export type ProfileResponse = {
  success: boolean;
  user: AuthUser & {
    bio?: string;
    location?: string;
    createdAt?: string;
    followersCount?: number;
    followingCount?: number;
    listingsCount?: number;
  };
};

export function getProfile() {
  return requestJson<ProfileResponse>("/api/auth/profile", {
    method: "GET",
  }).then((response) => ({
    ...response,
    user: response.user ? normalizeAuthUser(response.user) : response.user,
  }));
}

export function updateProfile(data: {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  bio?: string;
  dateOfBirth?: string;
  gender?: string;
}) {
  return requestJson<ProfileResponse>("/api/auth/update-profile", {
    method: "PUT",
    body: JSON.stringify(data),
  }).then((response) => ({
    ...response,
    user: response.user ? normalizeAuthUser(response.user) : response.user,
  }));
}

export function uploadProfileImage(formData: FormData) {
  const normalizedPath = "/api/auth/profile/upload-image";
  const uploadUrl = `${AUTH_API_BASE_URL}${normalizedPath}`;

  const doUpload = () => {
    const token = getAccessToken();
    return fetchWithTimeout(
      uploadUrl,
      {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "User-Agent": APP_USER_AGENT,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      },
      60_000,
    );
  };

  return doUpload()
    .then(async (res) => {
      if (res.status === 401) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          return doUpload();
        }
      }
      return res;
    })
    .then(async (res) => {
      const data = await parseJsonSafe(res);
      const payload = (data ?? {}) as {
        success?: boolean;
        message?: string;
        profileImage?: string;
        profileImageUrl?: string;
        imageUrl?: string;
        user?: AuthUser & { _id?: string };
      };

      const imageUrl = toAbsoluteUrl(payload.imageUrl);
      const uploadSucceeded =
        res.ok && (payload.success !== false || Boolean(imageUrl));

      if (!uploadSucceeded) {
        throw new AuthApiError(extractErrorMessage(data), res.status, data);
      }

      const user = payload.user ? normalizeAuthUser(payload.user) : undefined;
      const resolvedImageUrl =
        imageUrl ??
        toAbsoluteUrl(user?.profileImageUrl ?? user?.profileImage ?? null);

      return {
        ...payload,
        success: true,
        profileImage: toAbsoluteUrl(payload.profileImage ?? user?.profileImage),
        profileImageUrl:
          toAbsoluteUrl(payload.profileImageUrl ?? user?.profileImageUrl) ??
          resolvedImageUrl,
        imageUrl: resolvedImageUrl,
        user,
      };
    });
}

// ── Devices / Sessions ──────────────────────────────────────────────────────────

export type DeviceSession = {
  deviceId: string;
  deviceName: string;
  deviceType?: string;
  browser?: string;
  os?: string;
  ipAddress?: string;
  location?: string;
  lastActive?: string;
  lastActiveText?: string;
  lastSeen?: string;
  current?: boolean;
  isCurrentDevice?: boolean;
};

export async function getDevices() {
  const res = await requestJson<{
    success: boolean;
    devices: DeviceSession[];
    currentDeviceId?: string;
  }>("/api/auth/devices", { method: "GET" });

  // Normalize the `current` flag from backend's `isCurrentDevice` + `currentDeviceId`
  const devices = (res.devices || []).map((d) => ({
    ...d,
    current: d.current ?? d.isCurrentDevice ?? d.deviceId === res.currentDeviceId,
    lastActive: d.lastActive ?? d.lastSeen,
  }));

  return { ...res, devices };
}

export function revokeDevice(deviceId: string) {
  return requestJson<{ success: boolean; message?: string }>(
    `/api/auth/devices/${encodeURIComponent(deviceId)}`,
    { method: "DELETE" },
  );
}

export function logoutAllDevices() {
  return requestJson<{ success: boolean; message?: string }>(
    "/api/auth/logout-all",
    { method: "POST" },
  );
}

export function sendRecoveryPhoneOTP(phone: string, channel: "sms" | "whatsapp" = "sms") {
  return requestJson<{ success: boolean; message?: string; phone?: string; expiresIn?: number }>(
    "/api/auth/phone/update-send-otp",
    { method: "POST", body: JSON.stringify({ phone, channel }) },
  );
}

export function verifyRecoveryPhoneOTP(phone: string, otp: string) {
  return requestJson<{ success: boolean; message?: string; phone?: string; phoneVerified?: boolean }>(
    "/api/auth/phone/update-verify-otp",
    { method: "POST", body: JSON.stringify({ phone, otp }) },
  );
}

// ── Primary email change (OTP-verified) ──────────────────────────────────────

export function requestEmailChange(email: string) {
  return requestJson<{ success: boolean; message?: string; maskedEmail?: string; expiresIn?: number }>(
    "/api/auth/email/change-request",
    { method: "POST", body: JSON.stringify({ email }) },
  );
}

export function verifyEmailChange(email: string, otp: string) {
  return requestJson<{ success: boolean; message?: string; email?: string; attemptsRemaining?: number }>(
    "/api/auth/email/change-verify",
    { method: "POST", body: JSON.stringify({ email, otp }) },
  );
}

// ── Primary phone change (OTP-verified via Twilio) ───────────────────────────

export function requestPhoneChange(phone: string, channel: "sms" | "whatsapp" = "sms") {
  return requestJson<{ success: boolean; message?: string; phone?: string; expiresIn?: number }>(
    "/api/auth/phone/change-request",
    { method: "POST", body: JSON.stringify({ phone, channel }) },
  );
}

export function verifyPhoneChange(phone: string, otp: string) {
  return requestJson<{ success: boolean; message?: string; phone?: string; phoneVerified?: boolean }>(
    "/api/auth/phone/change-verify",
    { method: "POST", body: JSON.stringify({ phone, otp }) },
  );
}

// ── Activity / Login History ────────────────────────────────────────────────────

export type ActivityLogEntry = {
  _id?: string;
  id?: string;
  action: string;
  title?: string;
  description?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  timestamp?: string;
  category?: string;
  type?: string;
  metadata?: Record<string, unknown>;
};

export async function getActivityLog() {
  const res = await requestJson<{
    success: boolean;
    activity?: ActivityLogEntry[];
    activities?: ActivityLogEntry[];
    summary?: { totalActions: number; successfulLogins: number; securityEvents: number };
  }>("/api/auth/activity-log", { method: "GET" });

  // Backend returns `activity`, normalize to `activities` with mapped field names.
  // Prefer `type` (e.g. "login", "password_changed") for `action` so that icon
  // selection and stat counters work correctly, while `title` is preserved for
  // human-readable display in the UI.
  const raw = res.activity ?? res.activities ?? [];
  const activities = raw.map((item) => ({
    ...item,
    _id: item._id ?? item.id,
    action: item.action ?? item.type ?? item.title ?? "Activity",
    createdAt: item.createdAt ?? item.timestamp ?? new Date().toISOString(),
  }));

  return { ...res, activities };
}

export type FollowListType = "followers" | "following";

export type FollowListUser = {
  id: string;
  name: string;
  profileImageUrl?: string | null;
  provider?: string;
  createdAt?: string;
};

export type FollowListResponse = {
  success: boolean;
  type: FollowListType;
  users: FollowListUser[];
  followersCount: number;
  followingCount: number;
};

export function getFollowList(type: FollowListType) {
  return requestJson<FollowListResponse>(`/api/auth/followers?type=${type}`, {
    method: "GET",
  }).then((response) => ({
    ...response,
    followersCount: response.followersCount ?? 0,
    followingCount: response.followingCount ?? 0,
    users: (response.users ?? []).map((user) => ({
      ...user,
      id: String(user.id),
      profileImageUrl: toAbsoluteUrl(user.profileImageUrl),
    })),
  }));
}

export function toggleFollowUser(userId: string) {
  return requestJson<{
    success: boolean;
    isFollowing: boolean;
    followersCount: number;
    followingCount?: number;
    myFollowersCount?: number;
  }>(`/api/auth/follow/${encodeURIComponent(userId)}`, { method: "POST" });
}

export type SettingsPreferences = {
  emailNotifications: boolean;
  pushNotifications: boolean;
  marketingEmails: boolean;
  twoFactorAuth: boolean;
  theme: "light" | "dark" | "auto";
};

export function getSettingsPreferences() {
  return requestJson<{
    success: boolean;
    preferences: SettingsPreferences;
  }>("/api/settings/preferences", { method: "GET" });
}

export function updateSettingsPreferences(preferences: Partial<SettingsPreferences>) {
  return requestJson<{
    success: boolean;
    message?: string;
    preferences: SettingsPreferences;
  }>("/api/settings/preferences", {
    method: "PUT",
    body: JSON.stringify(preferences),
  });
}

export function getLoginHistory() {
  return requestJson<{ success: boolean; loginHistory: unknown[] }>(
    "/api/auth/login-history",
    { method: "GET" },
  );
}

// ── Password ────────────────────────────────────────────────────────────────────

export function changePassword(currentPassword: string, newPassword: string) {
  return requestJson<{ success: boolean; message?: string }>(
    "/api/auth/change-password",
    {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    },
  );
}

export function setupPassword(password: string) {
  return requestJson<{ success: boolean; message?: string }>(
    "/api/auth/setup-password",
    {
      method: "POST",
      body: JSON.stringify({ password }),
    },
  );
}

// ── Notifications ───────────────────────────────────────────────────────────────

export type NotificationSender = {
  id: string;
  name: string;
  profileImageUrl?: string | null;
  provider?: string;
};

export type NotificationItem = {
  _id: string;
  type: string;
  title?: string;
  message: string;
  read: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
  data?: Record<string, unknown>;
  sender?: NotificationSender | null;
};

export function getNotifications(page = 1, limit = 30) {
  return requestJson<{ success: boolean; notifications: NotificationItem[]; total?: number }>(
    `/api/notifications?page=${page}&limit=${limit}`,
    { method: "GET" },
  );
}

export function getUnreadCount() {
  return requestJson<{ success: boolean; unreadCount: number }>(
    "/api/notifications/unread-count",
    { method: "GET" },
  );
}

export function markAllNotificationsRead() {
  return requestJson<{ success: boolean; message?: string }>(
    "/api/notifications/read-all",
    { method: "PUT" },
  );
}

export function markNotificationRead(notificationId: string) {
  return requestJson<{ success: boolean }>(
    `/api/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: "PUT" },
  );
}

// ── Logout (server-side) ────────────────────────────────────────────────────────

export function logoutFromServer() {
  return requestJson<{ success: boolean; message?: string }>(
    "/api/auth/logout",
    { method: "POST" },
  );
}
