export const ExpoKeepAwakeTag = "ExpoKeepAwakeDefaultTag";

type KeepAwakeEvent = {
  state: "release";
};

type KeepAwakeListener = (event: KeepAwakeEvent) => void;

type EventSubscription = {
  remove: () => void;
};

export async function isAvailableAsync(): Promise<boolean> {
  return false;
}

export function useKeepAwake(): void {}

export async function activateKeepAwake(): Promise<void> {}

export async function activateKeepAwakeAsync(): Promise<void> {}

export async function deactivateKeepAwake(): Promise<void> {}

export function addListener(
  tagOrListener: string | KeepAwakeListener,
  listener?: KeepAwakeListener,
): EventSubscription {
  const resolvedListener =
    typeof tagOrListener === "function" ? tagOrListener : listener;

  resolvedListener?.({ state: "release" });

  return {
    remove() {},
  };
}