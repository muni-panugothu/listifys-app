import { MaterialIcons } from "@expo/vector-icons";
import { type Href, useRouter } from "@/lib/safe-router";
import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, ToastAndroid, View } from "react-native";

import { logoutFromServer } from "@/features/auth/services/auth-api";
import { useAppDispatch } from "@/store/hooks";
import { logout } from "@/store/slices/auth-slice";

function showToast(msg: string) {
  if (Platform.OS === "android") {
    ToastAndroid.show(msg, ToastAndroid.SHORT);
  }
}

export function LogoutModalScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logoutFromServer();
    } catch {
      /* proceed with local logout even if server call fails */
    }
    await dispatch(logout());
    showToast("Logged out successfully");
    setLoading(false);
    router.replace("/onboarding-slide-3" as Href);
  };

  return (
    <View className="flex-1 items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
      <Pressable className="absolute inset-0" onPress={() => router.back()} />
      <View className="w-full max-w-sm overflow-hidden rounded-2xl bg-white" style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 12 }}>
        {/* Content */}
        <View className="items-center p-6">
          {/* Icon */}
          <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-[rgba(186,26,26,0.1)]">
            <MaterialIcons name="logout" size={30} color="#BA1A1A" />
          </View>

          <Text className="mb-1 text-center text-[20px] font-semibold text-[#161D1A]">
            Are you sure you want to log out?
          </Text>
          <Text className="mb-6 text-center text-[14px] leading-5 text-[#3C4A44]">
            You will need to sign in again to access your account.
          </Text>

          {/* Buttons */}
          <View className="w-full gap-3">
            <Pressable
              onPress={handleLogout}
              disabled={loading}
              className="h-12 flex-row items-center justify-center gap-2 rounded-xl bg-[#BA1A1A]"
              style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }], opacity: loading ? 0.6 : 1 })}
            >
              {loading ? <ActivityIndicator color="#FFF" size="small" /> : <MaterialIcons name="logout" size={20} color="#FFFFFF" />}
              <Text className="text-[16px] font-semibold text-white">Logout</Text>
            </Pressable>
            <Pressable
              onPress={() => router.back()}
              className="h-12 items-center justify-center rounded-xl border border-[#BBCAC3] bg-white"
              style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
            >
              <Text className="text-[16px] font-semibold text-[#161D1A]">Cancel</Text>
            </Pressable>
          </View>
        </View>

        {/* Footer */}
        <View className="flex-row items-center justify-center gap-2 border-t border-slate-50 bg-[#EFF5F0] px-6 py-4">
          <MaterialIcons name="shield" size={18} color="#6C7A74" />
          <Text className="text-[12px] text-[#6C7A74]">Secure sign out enabled</Text>
        </View>
      </View>
    </View>
  );
}
