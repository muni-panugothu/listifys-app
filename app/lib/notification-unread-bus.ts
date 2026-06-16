type AdjustListener = (delta: number) => void;

const adjustListeners = new Set<AdjustListener>();

export function subscribeNotificationUnreadAdjust(listener: AdjustListener) {
  adjustListeners.add(listener);
  return () => adjustListeners.delete(listener);
}

export function adjustNotificationUnread(delta: number) {
  adjustListeners.forEach((listener) => listener(delta));
}
