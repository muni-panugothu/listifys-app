/**
 * Marketplace API Service
 *
 * Client-side API calls for:
 *   1. Alternate contact phone verification (Twilio Verify)
 *   2. Call-click event recording + tel: URL generation
 *
 * All functions reuse the authenticated requestJson from auth-api so tokens
 * are automatically attached and refreshed on 401.
 */

import {
  AUTH_API_BASE_URL,
  requestJson,
} from "@/features/auth/services/auth-api";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ContactOtpResponse {
  success: boolean;
  alreadyVerified?: boolean;
  isAccountPhone?: boolean;
  message: string;
  expiresIn?: number;
}

export interface ContactVerifyResponse {
  success: boolean;
  phone?: string;
  message: string;
}

export interface VerificationStatusResponse {
  success: boolean;
  verified: boolean;
  isAccountPhone: boolean;
  verifiedAt: string | null;
}

export interface CallClickResponse {
  success: boolean;
  telUrl: string;
  whatsappUrl?: string;
}

export interface CallStatsResponse {
  success: boolean;
  total: number;
  last7d: number;
  last30d: number;
}

// ── Contact phone OTP verification ────────────────────────────────────────────

/**
 * Send Twilio Verify OTP to an alternate contact phone number.
 *
 * Call this when the seller enters a number different from their account phone.
 *
 * @param phone   - E.164 format: "+919876543210"
 * @param channel - "sms" (default) | "whatsapp"
 */
export function sendContactOtp(
  phone: string,
  channel: "sms" | "whatsapp" = "sms",
): Promise<ContactOtpResponse> {
  return requestJson<ContactOtpResponse>("/api/marketplace/contact/send-otp", {
    method: "POST",
    body: JSON.stringify({ phone, channel }),
  });
}

/**
 * Verify the OTP entered by the seller for an alternate contact number.
 *
 * On success, the backend marks this phone as verified for the current user.
 *
 * @param phone - E.164 phone number (same as used in sendContactOtp)
 * @param otp   - The OTP code entered by the seller
 */
export function verifyContactOtp(
  phone: string,
  otp: string,
): Promise<ContactVerifyResponse> {
  return requestJson<ContactVerifyResponse>("/api/marketplace/contact/verify-otp", {
    method: "POST",
    body: JSON.stringify({ phone, otp }),
  });
}

/**
 * Check whether a specific phone number is already verified for the current user.
 *
 * Use this when loading the product form to pre-fill the verification state.
 */
export function getVerificationStatus(
  phone: string,
): Promise<VerificationStatusResponse> {
  const encoded = encodeURIComponent(phone);
  return requestJson<VerificationStatusResponse>(
    `/api/marketplace/contact/status?phone=${encoded}`,
  );
}

// ── Call click / analytics ─────────────────────────────────────────────────────

/**
 * Record a "Call Seller" click event and get the tel: URL to open the dialer.
 *
 * Usage in React Native:
 *   const { telUrl } = await recordCallClick({ ... });
 *   await Linking.openURL(telUrl);
 *
 * @param params.listingId    - MongoDB ObjectId of the listing
 * @param params.listingModel - Mongoose model name, e.g. "ForSale"
 * @param params.sellerId     - MongoDB ObjectId of the seller
 * @param params.contactPhone - E.164 phone number to call
 * @param params.platform     - "ios" | "android" | "web"
 * @param params.eventType    - "call_click" | "whatsapp_click"
 */
export function recordCallClick(params: {
  listingId: string;
  listingModel: string;
  sellerId: string;
  contactPhone: string;
  platform?: "ios" | "android" | "web" | "unknown";
  eventType?: "call_click" | "whatsapp_click";
}): Promise<CallClickResponse> {
  return requestJson<CallClickResponse>("/api/marketplace/call-click", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * Get call/contact stats for a listing (for seller dashboard).
 */
export function getCallStats(listingId: string): Promise<CallStatsResponse> {
  return requestJson<CallStatsResponse>(
    `/api/marketplace/call-stats/${listingId}`,
  );
}

// ── Utility: build full API URL (for direct fetch if needed) ──────────────────
export const MARKETPLACE_API_URL = AUTH_API_BASE_URL;
