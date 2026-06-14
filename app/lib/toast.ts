export type AppToastType = "success" | "error" | "info";

export type AppToastPayload = {
  type: AppToastType;
  title?: string;
  message: string;
};

type ToastListener = (payload: AppToastPayload) => void;

const listeners = new Set<ToastListener>();

function emitToast(payload: AppToastPayload) {
  listeners.forEach((listener) => listener(payload));
}

function normalizeToastText(title: string, message?: string) {
  if (message && message.trim().length > 0) {
    return { title, message };
  }

  return { title: undefined, message: title };
}

export function subscribeToasts(listener: ToastListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function showSuccessToast(title: string, message?: string) {
  const normalized = normalizeToastText(title, message);
  emitToast({ type: "success", ...normalized });
}

export function showErrorToast(title: string, message?: string) {
  // Callers pass "" to suppress the toast (e.g. user cancelled Google sign-in).
  if (message !== undefined && message.trim().length === 0) {
    return;
  }
  const normalized = normalizeToastText(title, message);
  emitToast({ type: "error", ...normalized });
}

export function showInfoToast(title: string, message?: string) {
  const normalized = normalizeToastText(title, message);
  emitToast({ type: "info", ...normalized });
}
