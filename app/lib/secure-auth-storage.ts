import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const SECURE_TOKEN_KEY = "listify_auth_tokens";
const LEGACY_TOKEN_KEY = "@listify/auth_tokens";

export type StoredTokens = {
  accessToken: string | null;
  refreshToken: string | null;
};

export async function readStoredTokens(): Promise<StoredTokens | null> {
  try {
    let raw = await SecureStore.getItemAsync(SECURE_TOKEN_KEY);

    if (!raw) {
      raw = await AsyncStorage.getItem(LEGACY_TOKEN_KEY);
      if (raw) {
        await SecureStore.setItemAsync(SECURE_TOKEN_KEY, raw);
        await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
      }
    }

    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredTokens;
    return {
      accessToken: parsed.accessToken ?? null,
      refreshToken: parsed.refreshToken ?? null,
    };
  } catch {
    return null;
  }
}

export async function writeStoredTokens(tokens: StoredTokens | null) {
  if (!tokens?.accessToken && !tokens?.refreshToken) {
    await Promise.all([
      SecureStore.deleteItemAsync(SECURE_TOKEN_KEY).catch(() => {}),
      AsyncStorage.removeItem(LEGACY_TOKEN_KEY).catch(() => {}),
    ]);
    return;
  }

  const payload = JSON.stringify(tokens);
  await SecureStore.setItemAsync(SECURE_TOKEN_KEY, payload);
  await AsyncStorage.removeItem(LEGACY_TOKEN_KEY).catch(() => {});
}
