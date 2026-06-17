import { TurboModuleRegistry } from "react-native";

/** True when the native KeyboardController turbo module is present in the binary. */
export function isKeyboardControllerNativeLinked(): boolean {
  try {
    return TurboModuleRegistry.get("KeyboardController") != null;
  } catch {
    return false;
  }
}
