import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { BackHandler, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Image } from "@/lib/nativewind-interop";

const thumbImage1 =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAQ1pYpzc3XQwJC8FtkvuIPpZcepupw_AvLAWDdOL6dp-Ea26gOMyjGGPUgD3jGYDyu3y_eUAWhFd-NWPITzSaKEXfvoJfnheOH6pMvTDiPeVteb-L1PABvoXRg2GMiJF7kE_dcLMt9GQJtNeOua3JdZHWDxORN3AnzYqt9AmQBCvB4CirHMmhAjn8vHGYvXzEbvyvDYImHPqC4jSNDJWBMRzsSdS9Kmpe-bZ9tCVhjoJrmuVTQqLBjYmTw8LAtfGMYOBoFyb2nB7s";
const thumbImage2 =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuA6WrS6NVnGu9l0nqopmUHiOQAhKXgaPiNdTvN676hG8rNLqRwQYbzsgYdLqS1nzIQOUOi4BWG-O0p-4SsyJ7uxgLWQ26UHyEfkwzWPBN2nwP_nIiTOJCTF6bcMSraL8Zd0fxaJx4AnD2avC_iQksoG1xdL3lpMPXKnNL2qPI9JYEikjKOXM4OLPpp0eHAhRRwgoCfyzkBnWezpZyfHUXjemQZDeKH9LpVupVnJxUF67DYIRyV9-UamupPFj8lO7Olyqlk_iXOi3rE";
const mapImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBKhbqcOHyENYUbAsV0AHhrzxGEk-9irSyTKaAU1haTPK7XUMKrbucZTC5FfOqXfqA2ZKrlTiR_ouoHvqGMu1BNjMxTTPrCwm_mSHUjAjAoc7yRu3mwdmaR11tSA4OHIFVXRb5OuFXA6EMXk_qWYfHgBtGxU_yo8CzVHvZXW9bNEuMGVIBD7n541h8E7azLsyHVqZxtgM6pEO4p2RWbKJfMyT2a-FhJAoPgAHdhymNBEbvsLlcitLoRq4R_spzdDdppmC5Lj3sfnPM";

export function PostAdStep3MediaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState("");

  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);

  const handleBack = () => {
    router.replace("/home-feed-root" as Href);
  };

  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        handleBack();
        return true;
      };

      const sub = BackHandler.addEventListener("hardwareBackPress", onHardwareBack);
      return () => sub.remove();
    }, [router]),
  );

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      {/* Top Bar */}
      <View
        className="absolute inset-x-0 top-0 z-50 flex-row items-center justify-between border-b border-slate-100 bg-white/90 px-4"
        style={{
          paddingTop: insets.top,
          height: topBarHeight,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 2,
        }}
      >
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={handleBack}
            className="h-9 w-9 items-center justify-center rounded-full"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons name="arrow-back" size={23} color="#0F172A" />
          </Pressable>
          <View>
            <Text className="text-[18px] font-semibold tracking-tight text-[#0F172A]">
              Step 3 of 3
            </Text>
            <Text className="text-[10px] font-bold uppercase tracking-widest text-[#006B55]">
              Media & Location
            </Text>
          </View>
        </View>
        <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <Text className="text-[12px] font-semibold text-[#27BB97]">
            Preview
          </Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: topBarHeight + 16,
          paddingBottom: 120 + Math.max(insets.bottom, 8),
        }}
      >
        <View className="px-4">
          {/* Photos Section */}
          <View className="mb-8">
            <View className="mb-4 flex-row items-end justify-between">
              <Text className="text-[18px] font-semibold text-[#161D1A]">
                Photos
              </Text>
              <Text className="text-[12px] font-medium text-[#6C7A74]">
                2 / 10 images
              </Text>
            </View>

            <View className="flex-row gap-3">
              {/* Add More */}
              <Pressable
                className="items-center justify-center rounded-xl border-2 border-dashed border-[#BBCAC3] bg-[#EFF5F0]"
                style={{ width: 100, height: 100 }}
              >
                <MaterialIcons name="add-a-photo" size={28} color="#6C7A74" />
                <Text className="mt-1 text-[10px] font-medium text-[#6C7A74]">
                  Add More
                </Text>
              </Pressable>

              {/* Thumbnail 1 */}
              <View
                className="overflow-hidden rounded-xl border border-[#BBCAC3]"
                style={{ width: 100, height: 100 }}
              >
                <Image
                  source={thumbImage1}
                  contentFit="cover"
                  className="h-full w-full"
                />
                <Pressable className="absolute right-1 top-1 rounded-full bg-white/70 p-1">
                  <MaterialIcons name="close" size={16} color="#BA1A1A" />
                </Pressable>
              </View>

              {/* Thumbnail 2 */}
              <View
                className="overflow-hidden rounded-xl border border-[#BBCAC3]"
                style={{ width: 100, height: 100 }}
              >
                <Image
                  source={thumbImage2}
                  contentFit="cover"
                  className="h-full w-full"
                />
                <Pressable className="absolute right-1 top-1 rounded-full bg-white/70 p-1">
                  <MaterialIcons name="close" size={16} color="#BA1A1A" />
                </Pressable>
              </View>
            </View>
            <Text className="mt-2 px-1 text-[12px] text-[#6C7A74]">
              Ads with high-quality photos get 5x more clicks.
            </Text>
          </View>

          {/* Location Section */}
          <View className="mb-8">
            <Text className="mb-4 px-1 text-[12px] font-medium text-[#161D1A]">
              Item Location
            </Text>
            <View className="mb-3 h-12 flex-row items-center rounded-xl border border-[#BBCAC3] bg-white px-4">
              <MaterialIcons name="location-on" size={20} color="#6C7A74" />
              <TextInput
                placeholder="Search for neighborhood or city..."
                placeholderTextColor="#94A3B8"
                className="ml-2 flex-1 text-[14px] text-[#161D1A]"
                style={{ paddingVertical: 0 }}
              />
            </View>
            <Pressable className="mb-4 flex-row items-center gap-2 px-1 py-1">
              <MaterialIcons name="my-location" size={20} color="#006B55" />
              <Text className="text-[12px] font-medium text-[#006B55]">
                Use Current Location
              </Text>
            </Pressable>

            {/* Map */}
            <View className="h-40 overflow-hidden rounded-2xl border border-[#BBCAC3]">
              <Image
                source={mapImage}
                contentFit="cover"
                className="h-full w-full"
              />
              <View className="absolute bottom-3 left-3 flex-row items-center gap-2 rounded-lg border border-[#BBCAC3] bg-white/90 px-3 py-1.5">
                <View className="h-2 w-2 rounded-full bg-[#006B55]" />
                <Text className="text-[11px] font-bold text-[#161D1A]">
                  Indiranagar, Bangalore
                </Text>
              </View>
            </View>
          </View>

          {/* Contact Details */}
          <View className="mb-8">
            <Text className="mb-4 px-1 text-[12px] font-medium text-[#161D1A]">
              Contact Details
            </Text>
            <View className="flex-row gap-2">
              <View className="h-12 w-24 items-center justify-center rounded-xl border border-[#BBCAC3] bg-white px-3">
                <Text className="text-[14px] text-[#161D1A]">+91</Text>
              </View>
              <View className="h-12 flex-1 flex-row items-center rounded-xl border border-[#BBCAC3] bg-white px-4">
                <MaterialIcons name="call" size={20} color="#6C7A74" />
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Mobile number"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  className="ml-2 flex-1 text-[14px] text-[#161D1A]"
                  style={{ paddingVertical: 0 }}
                />
              </View>
            </View>
            <View className="mt-3 flex-row items-center gap-3 rounded-xl border border-[rgba(39,187,151,0.2)] bg-[rgba(39,187,151,0.1)] p-4">
              <MaterialIcons name="verified-user" size={22} color="#006B55" />
              <Text className="flex-1 text-[11px] font-medium text-[#004535]">
                We'll send a verification code to this number to prevent spam
                and ensure trust.
              </Text>
            </View>
          </View>

          {/* Policy */}
          <Text className="mb-4 text-center text-[12px] text-[#6C7A74]">
            By clicking "Post Ad Now", you agree to Listify's{" "}
            <Text className="font-semibold text-[#006B55]">Terms of Use</Text>{" "}
            and{" "}
            <Text className="font-semibold text-[#006B55]">Privacy Policy</Text>
            .
          </Text>
        </View>
      </ScrollView>

      {/* Footer CTA */}
      <View
        className="absolute inset-x-0 bottom-0 z-50 border-t border-slate-100 bg-white/90 px-4 py-4"
        style={{
          paddingBottom: Math.max(insets.bottom, 16),
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 20,
          elevation: 8,
        }}
      >
        <Pressable
          onPress={() => router.push("/listing-success")}
          className="overflow-hidden rounded-2xl"
          style={({ pressed }) => ({
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}
        >
          <LinearGradient
            colors={["#27BB97", "#1E9E7E"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{
              height: 56,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Text className="text-[20px] font-semibold text-white">
              Post Ad Now
            </Text>
            <MaterialIcons name="rocket-launch" size={22} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}
