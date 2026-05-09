import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";

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

function resolveApiBaseUrl() {
  const explicitBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/$/, "");
  }

  // In development, Expo injects the dev server host (e.g. "192.168.1.5:8081")
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.manifest2?.extra?.expoGo?.debuggerHost;
  const host = hostUri?.split(":")[0];

  if (host && host !== "localhost" && host !== "127.0.0.1") {
    return `http://${host}:5000`;
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:5000";
  }

  return "http://localhost:5000";
}

export const AUTH_API_BASE_URL = resolveApiBaseUrl();

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

function normalizeAuthUser<T extends {
  avatar?: string | null;
  profileImage?: string | null;
  googleProfileImage?: string | null;
  profileImageUrl?: string | null;
}>(user: T): T {
  return {
    ...user,
    avatar: toAbsoluteUrl(user.avatar),
    profileImage: toAbsoluteUrl(user.profileImage),
    googleProfileImage: toAbsoluteUrl(user.googleProfileImage),
    profileImageUrl: toAbsoluteUrl(user.profileImageUrl),
  };
}

// ── Device User-Agent for backend device tracking ───────────────────────────────
function buildUserAgent(): string {
  const appVersion = Constants.expoConfig?.version ?? "1.0.0";
  const brand = Device.brand ?? "Unknown";
  const modelName = Device.modelName ?? "Unknown";
  const osName = Device.osName ?? Platform.OS;
  const osVersion = Device.osVersion ?? Platform.Version?.toString() ?? "";
  return `Listify/${appVersion} (${brand} ${modelName}; ${osName} ${osVersion})`;
}

const APP_USER_AGENT = buildUserAgent();

// ── Token management ────────────────────────────────────────────────────────────
const TOKEN_STORAGE_KEY = "@listify/auth_tokens";

let _accessToken: string | null = null;
let _refreshToken: string | null = null;
let _refreshPromise: Promise<boolean> | null = null;

export async function setTokens(access: string | null | undefined, refresh: string | null | undefined) {
  _accessToken = access ?? null;
  _refreshToken = refresh ?? null;
  if (_accessToken || _refreshToken) {
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ accessToken: _accessToken, refreshToken: _refreshToken }));
  } else {
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export async function restoreTokens() {
  const json = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
  if (json) {
    const { accessToken, refreshToken } = JSON.parse(json);
    _accessToken = accessToken ?? null;
    _refreshToken = refreshToken ?? null;
  }
}

export async function clearTokens() {
  _accessToken = null;
  _refreshToken = null;
  await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function getAccessToken() {
  return _accessToken;
}

async function refreshAccessToken(): Promise<boolean> {
  if (!_refreshToken) return false;

  // Deduplicate concurrent refresh calls
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      const res = await fetch(`${AUTH_API_BASE_URL}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
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

  if (typeof body.message === "string" && body.message.trim().length > 0) {
    return body.message;
  }

  if (body.errors && typeof body.errors === "object") {
    const firstError = Object.values(body.errors as Record<string, unknown>).find(
      (value) => typeof value === "string" && value.trim().length > 0,
    ) as string | undefined;

    if (firstError) {
      return firstError;
    }
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

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${AUTH_API_BASE_URL}${normalizedPath}`;

  const buildHeaders = () => ({
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": APP_USER_AGENT,
    ...(_accessToken ? { Authorization: `Bearer ${_accessToken}` } : {}),
    ...(init?.headers ?? {}),
  });

  let response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: buildHeaders(),
  });

  // Auto-refresh on 401 and retry once
  if (response.status === 401 && _refreshToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await fetch(url, {
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
    return error.message;
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
  const response = await requestJson<{
    success: boolean;
    clientIds?: GoogleClientIds;
  }>("/api/auth/google/client-ids", { method: "GET" });

  if (!response.clientIds) {
    throw new AuthApiError("Google sign-in is not configured on the server.");
  }

  return response.clientIds;
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
    followers?: number;
    following?: number;
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
  return fetch(`${AUTH_API_BASE_URL}${normalizedPath}`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "User-Agent": APP_USER_AGENT,
      ...(_accessToken ? { Authorization: `Bearer ${_accessToken}` } : {}),
    },
    body: formData,
  }).then(async (res) => {
    const data = await parseJsonSafe(res);
    if (!res.ok) throw new AuthApiError(extractErrorMessage(data), res.status, data);
    const payload = (data ?? {}) as {
      success: boolean;
      profileImage?: string;
      profileImageUrl?: string;
      imageUrl?: string;
      user?: AuthUser;
    };

    return {
      ...payload,
      profileImage: toAbsoluteUrl(payload.profileImage),
      profileImageUrl: toAbsoluteUrl(payload.profileImageUrl),
      imageUrl: toAbsoluteUrl(payload.imageUrl),
      user: payload.user ? normalizeAuthUser(payload.user) : payload.user,
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

  // Backend returns `activity`, normalize to `activities` with mapped field names
  const raw = res.activity ?? res.activities ?? [];
  const activities = raw.map((item) => ({
    ...item,
    _id: item._id ?? item.id,
    action: item.action ?? item.title ?? item.type ?? "Activity",
    createdAt: item.createdAt ?? item.timestamp ?? new Date().toISOString(),
  }));

  return { ...res, activities };
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

export type NotificationItem = {
  _id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
};

export function getNotifications(page = 1, limit = 30) {
  return requestJson<{ success: boolean; notifications: NotificationItem[]; total?: number }>(
    `/api/notifications?page=${page}&limit=${limit}`,
    { method: "GET" },
  );
}

export function getUnreadCount() {
  return requestJson<{ success: boolean; count: number }>(
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
