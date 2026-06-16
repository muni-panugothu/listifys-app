import React, { forwardRef } from "react";
import { KeyboardChatScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ScrollViewProps } from "react-native";
import type { KeyboardChatScrollViewProps } from "react-native-keyboard-controller";

const INPUT_MARGIN = 8;

/** Scroll wrapper for chat FlatList — keeps messages aligned with the keyboard. */
export const ChatKeyboardScrollView = forwardRef<
  React.ElementRef<typeof KeyboardChatScrollView>,
  ScrollViewProps & KeyboardChatScrollViewProps
>((props, ref) => {
  const { bottom } = useSafeAreaInsets();

  return (
    <KeyboardChatScrollView
      ref={ref}
      automaticallyAdjustContentInsets={false}
      contentInsetAdjustmentBehavior="never"
      keyboardDismissMode="interactive"
      offset={Math.max(bottom - INPUT_MARGIN, 0)}
      {...props}
    />
  );
});

ChatKeyboardScrollView.displayName = "ChatKeyboardScrollView";

/** Offset for KeyboardStickyView so the composer sits flush on the keyboard. */
export function useKeyboardStickyOffset() {
  const { bottom } = useSafeAreaInsets();
  return { closed: 0, opened: Math.max(bottom - INPUT_MARGIN, 0) } as const;
}
