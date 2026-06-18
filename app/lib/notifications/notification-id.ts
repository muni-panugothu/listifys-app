const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

export function isPersistedNotificationId(id: string | undefined): boolean {
  return Boolean(id && OBJECT_ID_RE.test(id));
}
