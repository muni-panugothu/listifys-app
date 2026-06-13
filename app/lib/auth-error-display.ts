import { AuthApiError } from "@/features/auth/services/auth-api";
import { GoogleSignInError } from "@/lib/google-sign-in";

function stringifyDetails(details: unknown): string | null {
  if (!details) return null;
  if (typeof details === "string") return details;
  try {
    return JSON.stringify(details, null, 2);
  } catch {
    return String(details);
  }
}

export function formatAuthFailureMessage(error: unknown, context = "Sign in") {
  if (error instanceof GoogleSignInError) {
    const lines = [error.message];
    if (error.code !== undefined && error.code !== null) {
      lines.push(`Google error code: ${error.code}`);
    }
    if (__DEV__) {
      lines.push("Source: Google Sign-In (native)");
      if (error.cancelled) lines.push("Cancelled: yes");
    }
    return lines.join("\n");
  }

  if (error instanceof AuthApiError) {
    const lines = [error.message];
    if (error.status) lines.push(`Status: ${error.status}`);
    const details = stringifyDetails(error.details);
    if (details) lines.push(details);
    if (__DEV__ && error.stack) lines.push(error.stack);
    return lines.join("\n");
  }

  if (error instanceof Error) {
    const lines = [error.message || `${context} failed.`];
    if (__DEV__ && error.stack) lines.push(error.stack);
    return lines.join("\n");
  }

  if (typeof error === "string" && error.trim()) return error;
  return `${context} failed. Please try again.`;
}
