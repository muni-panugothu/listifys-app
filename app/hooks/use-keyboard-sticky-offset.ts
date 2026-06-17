import { useSafeAreaInsets } from "react-native-safe-area-context";

const INPUT_MARGIN = 8;

/** Offset for KeyboardStickyView so the composer sits flush on the keyboard. */
export function useKeyboardStickyOffset() {
  const { bottom } = useSafeAreaInsets();
  return { closed: 0, opened: Math.max(bottom - INPUT_MARGIN, 0) } as const;
}
