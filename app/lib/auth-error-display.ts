import { AuthApiError } from "@/features/auth/services/auth-api";
import { GoogleSignInError, isGoogleSignInCancellation } from "@/lib/google-sign-in";

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
  if (isGoogleSignInCancellation(error)) {
    return "";
  }

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

/** Returns false when the user cancelled — no toast should be shown. */
export function reportGoogleSignInFailure(
  error: unknown,
  showToast: (title: string, message?: string) => void,
  context = "Google sign in",
): boolean {
  if (isGoogleSignInCancellation(error)) return false;
  const message = formatAuthFailureMessage(error, context);
  if (!message.trim()) return false;
  showToast("Google Sign In", message);
  return true;
}

/** Show a toast for Redux auth errors; skips user-initiated Google cancellations. */
export function reportAuthSliceError(
  error: unknown,
  showToast: (title: string, message?: string) => void,
  title: string,
  context: string,
): void {
  if (isGoogleSignInCancellation(error)) return;
  const message = formatAuthFailureMessage(error, context);
  if (!message.trim()) return;
  showToast(title, message);
}
