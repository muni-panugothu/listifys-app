import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { type Href, useRouter } from "@/lib/safe-router";
import { type ReactNode, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProfileAvatarImage } from "@/components/profile-avatar-image";
import { APP_SCREEN_BG } from "@/constants/theme";
import { ListifyFonts } from "@/constants/typography";
import { uploadProfileImage } from "@/features/auth/services/auth-api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchProfile,
  setAuthUser,
  updateUserProfile,
} from "@/store/slices/auth-slice";

const BRAND = "#27BB97";
const TEXT_PRIMARY = "#1A1A1A";
const TEXT_MUTED = "#6B7280";
const USER_STORAGE_KEY = "@listify/auth_user";

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer-not-to-say", label: "Prefer not" },
] as const;

function FieldLabel({ children }: { children: string }) {
  return (
    <Text
      className="mb-2 text-[13px]"
      style={{ fontFamily: ListifyFonts.medium, color: TEXT_MUTED }}
    >
      {children}
    </Text>
  );
}

function FormCard({ children }: { children: React.ReactNode }) {
  return (
    <View
      className="rounded-2xl bg-white p-4"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      {children}
    </View>
  );
}

export function ProfileDetailsEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const sessionHydrated = useAppSelector((s) => s.auth.sessionHydrated);
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
  const [avatarKey, setAvatarKey] = useState(0);

  const avatarUser = uploadedImageUri
    ? {
        profileImageUrl: uploadedImageUri,
        profileImage: uploadedImageUri,
        avatar: uploadedImageUri,
      }
    : user;

  useEffect(() => {
    if (!sessionHydrated) return;
    if (!isAuthenticated) {
      router.replace("/sign-in" as Href);
      return;
    }
    if (!user) {
      void dispatch(fetchProfile());
    }
  }, [dispatch, isAuthenticated, router, sessionHydrated, user]);

  useEffect(() => {
    if (user) {
      setFullName(user.name || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
      setLocation((user as { address?: string; location?: string }).address || (user as { location?: string }).location || "");
      setBio((user as { bio?: string }).bio || "");
      setGender((user as { gender?: string }).gender || "");
      const dob = (user as { dateOfBirth?: string }).dateOfBirth;
      setDateOfBirth(dob ? new Date(dob).toISOString().split("T")[0] : "");
    }
  }, [user]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/dashboard-home" as Href);
  };

  const handleSave = async () => {
    const result = await dispatch(
      updateUserProfile({
        name: fullName,
        email,
        phone,
        address: location,
        bio,
        dateOfBirth,
        gender,
      }),
    );
    if (updateUserProfile.fulfilled.match(result)) {
      Alert.alert("Saved", "Your profile was updated.");
      handleBack();
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

      if (pickerResult.canceled || !pickerResult.assets?.[0]) return;

      const asset = pickerResult.assets[0];
      const filename = asset.uri.split("/").pop() || `profile_${Date.now()}.jpg`;
      const match = /\.(\w+)$/.exec(filename);
      const ext = match ? match[1].toLowerCase() : "jpg";
      const mimeType =
        asset.mimeType ?? `image/${ext === "jpg" ? "jpeg" : ext}`;

      const formData = new FormData();
      formData.append("image", {
        uri: Platform.OS === "android" ? asset.uri : asset.uri.replace("file://", ""),
        name: filename,
        type: mimeType,
      } as unknown as Blob);

      setUploading(true);
      const uploadRes = await uploadProfileImage(formData);
      const freshImageUri =
        uploadRes.imageUrl ||
        uploadRes.user?.profileImageUrl ||
        uploadRes.user?.profileImage ||
        uploadRes.profileImageUrl ||
        uploadRes.profileImage ||
        null;

      if (freshImageUri) {
        const cacheBusted = `${freshImageUri}${freshImageUri.includes("?") ? "&" : "?"}t=${Date.now()}`;
        setUploadedImageUri(cacheBusted);
        setAvatarKey((k) => k + 1);
      }
      if (uploadRes.user) {
        dispatch(setAuthUser(uploadRes.user));
        await AsyncStorage.setItem(
          USER_STORAGE_KEY,
          JSON.stringify(uploadRes.user),
        );
      }

      // Refresh profile in background — don't fail the upload if this errors
      try {
        await dispatch(fetchProfile()).unwrap();
      } catch {
        // Upload already succeeded; ignore refresh errors
      }

      Alert.alert("Photo updated", "Your profile picture was saved.");
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Could not upload image";
      Alert.alert("Upload failed", message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: APP_SCREEN_BG }}>
      <View
        className="flex-row items-center justify-between px-5"
        style={{ paddingTop: insets.top + 8, paddingBottom: 12 }}
      >
        <View className="flex-row items-center">
          <Pressable
            onPress={handleBack}
            hitSlop={12}
            className="mr-2 h-10 w-10 items-center justify-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons name="chevron-left" size={32} color={TEXT_PRIMARY} />
          </Pressable>
          <Text
            className="text-[22px]"
            style={{ fontFamily: ListifyFonts.bold, color: TEXT_PRIMARY }}
          >
            Edit profile
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/app-settings" as Href)}
          className="h-10 w-10 items-center justify-center rounded-full bg-white"
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          <MaterialIcons name="settings" size={22} color={TEXT_MUTED} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 24,
        }}
      >
        <FormCard>
          <View className="items-center py-2">
            <View className="relative">
              <View
                className="h-28 w-28 overflow-hidden rounded-full border-[3px] border-white"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <ProfileAvatarImage
                  key={avatarKey}
                  user={avatarUser}
                  fallbackName={fullName || user?.name}
                  className="h-full w-full"
                  iconSize={40}
                />
              </View>
              <Pressable
                onPress={handlePickImage}
                className="absolute bottom-0 right-0 h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: BRAND }}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <MaterialIcons name="photo-camera" size={18} color="#FFFFFF" />
                )}
              </Pressable>
            </View>
            <Text
              className="mt-3 text-[13px]"
              style={{ fontFamily: ListifyFonts.regular, color: TEXT_MUTED }}
            >
              Tap camera to change photo
            </Text>
          </View>
        </FormCard>

        <View className="mt-4 gap-4">
          <FormCard>
            <FieldLabel>Full name</FieldLabel>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your name"
              placeholderTextColor="#9CA3AF"
              className="h-12 rounded-xl bg-[#F6F7F8] px-4 text-[15px]"
              style={{ fontFamily: ListifyFonts.regular, color: TEXT_PRIMARY }}
            />
          </FormCard>

          <FormCard>
            <FieldLabel>Email</FieldLabel>
            <TextInput
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="you@email.com"
              placeholderTextColor="#9CA3AF"
              className="h-12 rounded-xl bg-[#F6F7F8] px-4 text-[15px]"
              style={{ fontFamily: ListifyFonts.regular, color: TEXT_PRIMARY }}
            />
            <View className="mt-4">
              <FieldLabel>Phone</FieldLabel>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="+1 555 000 0000"
                placeholderTextColor="#9CA3AF"
                className="h-12 rounded-xl bg-[#F6F7F8] px-4 text-[15px]"
                style={{ fontFamily: ListifyFonts.regular, color: TEXT_PRIMARY }}
              />
            </View>
          </FormCard>

          <FormCard>
            <FieldLabel>Gender</FieldLabel>
            <View className="flex-row flex-wrap gap-2">
              {GENDER_OPTIONS.map((option) => {
                const selected = gender === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setGender(option.value)}
                    className="rounded-full px-4 py-2"
                    style={{
                      backgroundColor: selected ? "rgba(39,187,151,0.14)" : "#F6F7F8",
                      borderWidth: 1,
                      borderColor: selected ? BRAND : "transparent",
                    }}
                  >
                    <Text
                      className="text-[13px]"
                      style={{
                        fontFamily: selected ? ListifyFonts.semiBold : ListifyFonts.medium,
                        color: selected ? BRAND : TEXT_MUTED,
                      }}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View className="mt-4">
              <FieldLabel>Date of birth</FieldLabel>
              <TextInput
                value={dateOfBirth}
                onChangeText={setDateOfBirth}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9CA3AF"
                className="h-12 rounded-xl bg-[#F6F7F8] px-4 text-[15px]"
                style={{ fontFamily: ListifyFonts.regular, color: TEXT_PRIMARY }}
              />
            </View>
          </FormCard>

          <FormCard>
            <FieldLabel>Location</FieldLabel>
            <View className="h-12 flex-row items-center rounded-xl bg-[#F6F7F8] px-4">
              <MaterialIcons name="location-on" size={20} color={BRAND} />
              <TextInput
                value={location}
                onChangeText={setLocation}
                placeholder="City, area"
                placeholderTextColor="#9CA3AF"
                className="ml-2 flex-1 text-[15px]"
                style={{ fontFamily: ListifyFonts.regular, color: TEXT_PRIMARY }}
              />
            </View>
            <View className="mt-4">
              <FieldLabel>Bio</FieldLabel>
              <TextInput
                value={bio}
                onChangeText={(t) => t.length <= 150 && setBio(t)}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholder="Tell buyers a bit about you"
                placeholderTextColor="#9CA3AF"
                className="min-h-[96px] rounded-xl bg-[#F6F7F8] px-4 py-3 text-[15px] leading-[22px]"
                style={{ fontFamily: ListifyFonts.regular, color: TEXT_PRIMARY }}
              />
              <Text
                className="mt-2 text-right text-[12px]"
                style={{ fontFamily: ListifyFonts.regular, color: TEXT_MUTED }}
              >
                {bio.length}/150
              </Text>
            </View>
          </FormCard>
        </View>
      </ScrollView>

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: "#E5E7EB",
          backgroundColor: "#FFFFFF",
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 12),
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 16,
        }}
      >
        <Pressable
          onPress={handleSave}
          disabled={status === "loading"}
          style={({ pressed }) => ({
            opacity: status === "loading" ? 0.6 : pressed ? 0.9 : 1,
          })}
        >
          <View
            style={{
              minHeight: 52,
              borderRadius: 16,
              backgroundColor: "#1A1A1A",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {status === "loading" ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text
                style={{
                  fontFamily: ListifyFonts.semiBold,
                  fontSize: 16,
                  color: "#FFFFFF",
                }}
              >
                Save changes
              </Text>
            )}
          </View>
        </Pressable>
      </View>
    </View>
  );
}
