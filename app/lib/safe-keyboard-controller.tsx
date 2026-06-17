import React, {
  forwardRef,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  ScrollView,
  View,
  type ScrollViewProps,
  type ViewStyle,
} from "react-native";

import { isKeyboardControllerNativeLinked } from "@/lib/keyboard-controller-native";

type ProviderProps = {
  children: ReactNode;
  statusBarTranslucent?: boolean;
  navigationBarTranslucent?: boolean;
  preserveEdgeToEdge?: boolean;
};

type StickyProps = {
  children?: ReactNode;
  offset?: { closed?: number; opened?: number };
  style?: ViewStyle;
};

type GestureAreaProps = {
  children?: ReactNode;
  style?: ViewStyle;
  interpolator?: string;
  showOnSwipeUp?: boolean;
  enableSwipeToDismiss?: boolean;
};

type AwareScrollProps = ScrollViewProps & {
  children?: ReactNode;
  bottomOffset?: number;
  extraKeyboardSpace?: number;
  disableScrollOnKeyboardHide?: boolean;
};

type ChatScrollProps = ScrollViewProps & {
  offset?: number;
  automaticallyAdjustContentInsets?: boolean;
  contentInsetAdjustmentBehavior?: string;
  keyboardDismissMode?: ScrollViewProps["keyboardDismissMode"];
};

let keyboardLinked = false;

let KeyboardProviderImpl: ComponentType<ProviderProps> = ({ children }) => (
  <>{children}</>
);
let KeyboardStickyViewImpl: ComponentType<StickyProps> = ({ children, style }) => (
  <View style={style}>{children}</View>
);
let KeyboardAwareScrollViewImpl: ComponentType<AwareScrollProps> = ({
  children,
  style,
  contentContainerStyle,
  ...scrollProps
}) => (
  <ScrollView
    style={[{ flex: 1 }, style]}
    keyboardShouldPersistTaps="handled"
    contentContainerStyle={contentContainerStyle}
    {...scrollProps}
  >
    {children}
  </ScrollView>
);
let KeyboardGestureAreaImpl: ComponentType<GestureAreaProps> = ({ children, style }) => (
  <View style={[{ flex: 1 }, style]}>{children}</View>
);
let KeyboardChatScrollViewImpl: ComponentType<ChatScrollProps> = forwardRef<
  ScrollView,
  ChatScrollProps
>(({ children, style, ...scrollProps }, ref) => (
  <ScrollView ref={ref} style={style} {...scrollProps}>
    {children}
  </ScrollView>
));
KeyboardChatScrollViewImpl.displayName = "KeyboardChatScrollView";

if (isKeyboardControllerNativeLinked()) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-keyboard-controller");
    if (mod.KeyboardProvider) {
      KeyboardProviderImpl = mod.KeyboardProvider;
      keyboardLinked = true;
    }
    if (mod.KeyboardStickyView) {
      KeyboardStickyViewImpl = mod.KeyboardStickyView;
    }
    if (mod.KeyboardAwareScrollView) {
      KeyboardAwareScrollViewImpl = mod.KeyboardAwareScrollView;
    }
    if (mod.KeyboardGestureArea) {
      KeyboardGestureAreaImpl = mod.KeyboardGestureArea;
    }
    if (mod.KeyboardChatScrollView) {
      KeyboardChatScrollViewImpl = mod.KeyboardChatScrollView;
    }
  } catch (error) {
    if (__DEV__) {
      console.warn(
        "[Keyboard] react-native-keyboard-controller failed to load — rebuild native app:",
        "npx expo prebuild --platform android --clean && npx expo run:android",
        error,
      );
    }
  }
} else if (__DEV__) {
  console.warn(
    "[Keyboard] react-native-keyboard-controller not linked — using fallbacks. Rebuild:",
    "npx expo prebuild --platform android --clean && npx expo run:android",
  );
}

export const KeyboardProvider = KeyboardProviderImpl;
export const KeyboardStickyView = KeyboardStickyViewImpl;
export const KeyboardAwareScrollView = KeyboardAwareScrollViewImpl;
export const KeyboardGestureArea = KeyboardGestureAreaImpl;
export const KeyboardChatScrollView = KeyboardChatScrollViewImpl;

export function isKeyboardControllerLinked(): boolean {
  return keyboardLinked;
}
