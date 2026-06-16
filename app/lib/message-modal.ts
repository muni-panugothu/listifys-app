export type MessageModalType = "error" | "success" | "info";

export type MessageModalPayload = {
  type: MessageModalType;
  title: string;
  message: string;
};

type MessageModalListener = (payload: MessageModalPayload) => void;

const listeners = new Set<MessageModalListener>();

function emitMessageModal(payload: MessageModalPayload) {
  listeners.forEach((listener) => listener(payload));
}

function normalizeMessage(title: string, message?: string) {
  if (message && message.trim().length > 0) {
    return { title, message };
  }
  return { title, message: title };
}

export function subscribeMessageModals(listener: MessageModalListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function showErrorModal(title: string, message?: string) {
  if (message !== undefined && message.trim().length === 0) {
    return;
  }
  const normalized = normalizeMessage(title, message);
  emitMessageModal({ type: "error", ...normalized });
}

export function showSuccessModal(title: string, message?: string) {
  const normalized = normalizeMessage(title, message);
  emitMessageModal({ type: "success", ...normalized });
}

export function showInfoModal(title: string, message?: string) {
  const normalized = normalizeMessage(title, message);
  emitMessageModal({ type: "info", ...normalized });
}
