import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { type Href, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AUTH_API_BASE_URL, uploadProfileImage } from "@/features/auth/services/auth-api";
import { Image } from "@/lib/nativewind-interop";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchProfile, setAuthUser, updateUserProfile } from "@/store/slices/auth-slice";

const defaultAvatar = "https://ui-avatars.com/api/?name=User&background=27BB97&color=fff&size=128";

export function ProfileDetailsEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const status = useAppSelector((s) => s.auth.status);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [uploadedImageUri, setUploadedImageUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const ensureAbsoluteUri = (value?: string | null) => {
    if (!value) return value;
    if (/^https?:\/\//i.test(value) || value.startsWith("data:") || value.startsWith("file:")) return value;
    if (value.startsWith("/")) return `${AUTH_API_BASE_URL}${value}`;
    return `${AUTH_API_BASE_URL}/${value}`;
  };

  const profileImageUri =
    ensureAbsoluteUri(uploadedImageUri) ??
    ensureAbsoluteUri(user?.profileImageUrl) ??
    ensureAbsoluteUri(user?.profileImage) ??
    ensureAbsoluteUri(user?.googleProfileImage) ??
    ensureAbsoluteUri(user?.avatar) ??
    defaultAvatar;

  useEffect(() => {
    if (user) {
      setFullName(user.name || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
      setLocation((user as any).address || (user as any).location || "");
      setBio((user as any).bio || "");
      setGender((user as any).gender || "");
      setDateOfBirth((user as any).dateOfBirth ? new Date((user as any).dateOfBirth).toISOString().split("T")[0] : "");
      setUploadedImageUri((prev) => prev ?? null);
    }
  }, [user]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/home-feed-root" as Href);
  };

  const handleSave = async () => {
    const result = await dispatch(
      updateUserProfile({ name: fullName, email, phone, address: location, bio, dateOfBirth, gender }),
    );
    if (updateUserProfile.fulfilled.match(result)) {
      Alert.alert("Success", "Profile updated successfully");
    } else {
      Alert.alert("Error", (result.payload as string) || "Failed to update profile");
    }
  };

  const handlePickImage = async () => {
    try {
      const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permResult.granted) {
        Alert.alert("Permission required", "Please allow access to your photos.");
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (pickerResult.canceled || !pickerResult.assets?.[0]) {
        return;
      }

      const asset = pickerResult.assets[0];
      const formData = new FormData();
      formData.append("image", {
        uri: asset.uri,
        name: "profile.jpg",
        type: "image/jpeg",
      } as any);

      setUploading(true);
      const uploadRes = await uploadProfileImage(formData);
      const freshImageUri =
        uploadRes.user?.profileImageUrl ||
        uploadRes.user?.profileImage ||
        uploadRes.profileImageUrl ||
        uploadRes.profileImage ||
        uploadRes.imageUrl ||
        null;

      if (freshImageUri) {
        setUploadedImageUri(freshImageUri);
      }

      if (uploadRes.user) {
        dispatch(setAuthUser(uploadRes.user));
      }

      await dispatch(fetchProfile()).unwrap();
      Alert.alert("Success", "Profile image updated successfully");
    } catch (e: any) {
      const message = e?.message || "Could not upload image";
      const nativeMissing = String(message).includes("ExponentImagePicker") ||
        String(message).includes("native module");
      Alert.alert(
        nativeMissing ? "Feature requires rebuild" : "Upload failed",
        nativeMissing
          ? "Image picker native module is missing in this installed build. Rebuild and reinstall the Android app, then reopen it."
          : message,
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      {/* Top Bar */}
      <View
        className="absolute inset-x-0 top-0 z-50 flex-row items-center justify-between border-b border-slate-100 bg-white/90 px-4"
        style={{ paddingTop: insets.top, height: topBarHeight, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 }}
      >
        <View className="flex-row items-center gap-4">
          <Pressable onPress={handleBack} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
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
                <Image source={profileImageUri} contentFit="cover" className="h-full w-full" />
              </View>
              <Pressable onPress={handlePickImage} className="absolute bottom-1 right-1 h-9 w-9 items-center justify-center rounded-full bg-[#27BB97]" style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 }}>
                {uploading ? <ActivityIndicator size="small" color="#FFF" /> : <MaterialIcons name="photo-camera" size={18} color="#FFFFFF" />}
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
              <Text className="px-1 text-[12px] font-medium text-[#161D1A]">Gender</Text>
              <View className="flex-row gap-2">
                {(["male", "female", "other", "prefer-not-to-say"] as const).map((g) => {
                  const labels: Record<string, string> = { male: "Male", female: "Female", other: "Other", "prefer-not-to-say": "Prefer not to say" };
                  const selected = gender === g;
                  return (
                    <Pressable key={g} onPress={() => setGender(g)} className="flex-1 items-center rounded-xl border px-2 py-3" style={{ borderColor: selected ? "#27BB97" : "#F1F5F9", backgroundColor: selected ? "rgba(39,187,151,0.1)" : "#FFFFFF" }}>
                      <Text className="text-[12px] font-medium" style={{ color: selected ? "#006B55" : "#64748B" }}>{labels[g]}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View className="gap-2">
              <Text className="px-1 text-[12px] font-medium text-[#161D1A]">Date of Birth</Text>
              <TextInput value={dateOfBirth} onChangeText={setDateOfBirth} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" className="h-12 rounded-xl border border-slate-100 bg-white px-4 text-[14px] text-[#161D1A]" style={{ paddingVertical: 0 }} />
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
        <Pressable onPress={handleSave} disabled={status === "loading"} className="overflow-hidden rounded-xl" style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }], opacity: status === "loading" ? 0.6 : 1 })}>
          <LinearGradient colors={["#27BB97", "#1E9E7E"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ height: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, shadowColor: "#27BB97", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 }}>
            {status === "loading" ? <ActivityIndicator color="#FFF" /> : <MaterialIcons name="check-circle" size={22} color="#FFFFFF" />}
            <Text className="text-[18px] font-semibold text-white">Save Changes</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}
