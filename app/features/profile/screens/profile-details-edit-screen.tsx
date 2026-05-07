import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Image } from "@/lib/nativewind-interop";

const profileImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAVMV7uLhF5SdxXjdDg3uL4I-i5ornCKRk-r3WdGEymIwLJ6N3flIlFOehIZ1kFsjdRZ80ZC75OGDnQ0IRgS2tI1mjjyVk8WOat43RTWVp-FEiuke50fSCjvCRY_2EZVZ4piAOdwFnHNksKvUq2Va8gAcotnwvNp-MYQIb8l-qhAAXPa36B2cCqHQml8_nAfnynLVCUWxfWfeOKqx3WL4quU3G4FaBKpKkjVehZeKGxZx1tdo-QoiRsFz6iVrNW0pDY91TnVbh4cYk";

export function ProfileDetailsEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);

  const [fullName, setFullName] = useState("Arjun Sharma");
  const [email, setEmail] = useState("arjun.s@gmail.com");
  const [phone, setPhone] = useState("+91 98765-XXXXX");
  const [location, setLocation] = useState("Indiranagar, Bangalore");
  const [bio, setBio] = useState("Minimalist enthusiast selling quality pre-owned tech and furniture");

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      {/* Top Bar */}
      <View
        className="absolute inset-x-0 top-0 z-50 flex-row items-center justify-between border-b border-slate-100 bg-white/90 px-4"
        style={{ paddingTop: insets.top, height: topBarHeight, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 }}
      >
        <View className="flex-row items-center gap-4">
          <Pressable onPress={() => router.back()} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <MaterialIcons name="arrow-back" size={24} color="#27BB97" />
          </Pressable>
          <Text className="text-[14px] font-semibold tracking-tight text-[#161D1A]">Profile</Text>
        </View>
        <Pressable onPress={() => router.push("/app-settings")} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <MaterialIcons name="settings" size={22} color="#64748B" />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: topBarHeight + 16, paddingBottom: 100 + Math.max(insets.bottom, 8) }}
      >
        <View className="px-4">
          {/* Profile Photo */}
          <View className="mb-10 items-center">
            <View className="relative">
              <View className="h-32 w-32 overflow-hidden rounded-full border-4 border-white" style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 }}>
                <Image source={profileImage} contentFit="cover" className="h-full w-full" />
              </View>
              <Pressable className="absolute bottom-1 right-1 h-9 w-9 items-center justify-center rounded-full bg-[#27BB97]" style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 }}>
                <MaterialIcons name="photo-camera" size={18} color="#FFFFFF" />
              </Pressable>
            </View>
            <Text className="mt-4 text-[12px] font-medium text-[#3C4A44]">Tap to update photo</Text>
          </View>

          {/* Form */}
          <View className="gap-6">
            <View className="gap-2">
              <Text className="px-1 text-[12px] font-medium text-[#161D1A]">Full Name</Text>
              <TextInput value={fullName} onChangeText={setFullName} className="h-12 rounded-xl border border-slate-100 bg-white px-4 text-[14px] text-[#161D1A]" style={{ paddingVertical: 0 }} />
            </View>
            <View className="gap-2">
              <Text className="px-1 text-[12px] font-medium text-[#161D1A]">Email</Text>
              <TextInput value={email} onChangeText={setEmail} keyboardType="email-address" className="h-12 rounded-xl border border-slate-100 bg-white px-4 text-[14px] text-[#161D1A]" style={{ paddingVertical: 0 }} />
            </View>
            <View className="gap-2">
              <Text className="px-1 text-[12px] font-medium text-[#161D1A]">Phone</Text>
              <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" className="h-12 rounded-xl border border-slate-100 bg-white px-4 text-[14px] text-[#161D1A]" style={{ paddingVertical: 0 }} />
            </View>
            <View className="gap-2">
              <Text className="px-1 text-[12px] font-medium text-[#161D1A]">Location</Text>
              <View className="relative">
                <View className="absolute left-4 top-0 bottom-0 justify-center z-10">
                  <MaterialIcons name="location-on" size={18} color="#94A3B8" />
                </View>
                <TextInput value={location} onChangeText={setLocation} className="h-12 rounded-xl border border-slate-100 bg-white pl-11 pr-4 text-[14px] text-[#161D1A]" style={{ paddingVertical: 0 }} />
              </View>
            </View>
            <View className="gap-2">
              <Text className="px-1 text-[12px] font-medium text-[#161D1A]">Bio</Text>
              <TextInput value={bio} onChangeText={(t) => t.length <= 150 && setBio(t)} multiline numberOfLines={4} textAlignVertical="top" className="rounded-xl border border-slate-100 bg-white px-4 py-3 text-[14px] leading-5 text-[#161D1A]" />
              <Text className="text-right text-[12px] text-[#94A3B8]">{bio.length}/150 characters</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View className="absolute inset-x-0 bottom-0 z-50 border-t border-slate-100 bg-white/90 p-4" style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
        <Pressable className="overflow-hidden rounded-xl" style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
          <LinearGradient colors={["#27BB97", "#1E9E7E"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ height: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, shadowColor: "#27BB97", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 }}>
            <MaterialIcons name="check-circle" size={22} color="#FFFFFF" />
            <Text className="text-[18px] font-semibold text-white">Save Changes</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}
