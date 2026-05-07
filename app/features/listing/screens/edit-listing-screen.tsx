import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Image } from "@/lib/nativewind-interop";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IMAGE_GAP = 12;
const SIDE_IMAGE_SIZE = (SCREEN_WIDTH - 32 - IMAGE_GAP * 2) / 3;

const coverImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBk_u9vLO5X8o1MIQDAixKpK2yUorLPZ0SSjoNG9qCVaDJMhMyOzRpacRLesjhT7plFdU7n4vdk5kb3VcdTODd-4gem7zKeif6DI7jATSpvGF6EE59EAt9QgfybK4UddJogvxB5A-nfA51y_KVOuovI47JAzb_Vw5ZbUqpUCr_G3RQT11lC-IVKKc1hRn1-TsNvBYlmn_-P_gW1jMLdILw0Fdl6jVwxTqXZbqzK6L_8xNKnCLx6L1w9rTrxh7GwFGN83WeR0FwPkLY";
const sideImage1 =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAYVWM9XaZcQKZzpEYh49ASgtWRAWjFH-hF25jpXOnlP-WiqUflI7SGI7hlKH3yCl1rFtRfiny-fa1nZkE8Mr67QUOsojibr1lDAtbl5QK5n6jMlzDl22U2WAWYvo7A5Pnz4E2NSQAuHY6JRZblQopxdi0rAaem1MGz-VUqC5_kicVkClRbZ-NemtIudj3RAbN5LQ0-Mc8ODuBq2eit2QrxsN7WN7bTN4XANdPJCgqinppVNQLMGY9PTzkypOFhTGeFypjGGS8t8xo";
const sideImage2 =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDZV-QYtgdSZYlaz1rNaCegjHGCWpXa4wtBpL5nMLPw9JXj0nD4pV4Xqb_PLCrkF23XoqL6IJ9f0bWuMFOTXdl186e8XStwPwARBAM1SapnpHRipYWv8QK292Fog_iLSF4L9CL4Hpb8afIMCarKJB2Sk3EJxezGiuYK5kvsunTpd5lIApz34QC2t4XV0zz7IzUOPT0wSaCnere549ElUIKoQozZ7Zw7z-uA7qu2BZU4ccFSl8ymjgu1DrtP97zi3fGiRwCSgJEUwdQ";
const mapImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDEFykSAMqZz4737T-69Va30y90wI7asmsDeAdGHWGLL5blWmn1uSHm04clvGIcnznXBK4G50QQTHkExq0Zcug5FiWitYo14lGsF4td4lsSM49tAah-eyVE9ikMAUoeXGOCGKZsLfLsdJwTW8PuiY9aSuPUPVGSkTkVlNOF-5nrnr2IgV0Zw1L_i59Dv00yQHySgS_d9CVt27Y96e-1O023kK4AU589vO9fKR7iAjl4vZcCTZKfq6aDAwX8bXcxyNTO4smJzQsjqy0";

export function EditListingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [price, setPrice] = useState("24500");
  const [title, setTitle] = useState(
    "Modern Velvet 3-Seater Sofa - Forest Green",
  );
  const [description, setDescription] = useState(
    "Minimalist forest green velvet sofa. Purchased 6 months ago. Immaculate condition with no stains or tears. Sturdy oak wood frame. Perfect for modern living spaces. Selling because I'm relocating.",
  );

  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      {/* Top Bar */}
      <View
        className="absolute inset-x-0 top-0 z-50 flex-row items-center justify-between border-b border-[#DDE4DF] bg-white/90 px-4"
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
            onPress={() => router.back()}
            className="h-9 w-9 items-center justify-center rounded-full"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons name="arrow-back" size={23} color="#161D1A" />
          </Pressable>
          <Text className="text-[20px] font-semibold text-[#161D1A]">
            Edit Listing
          </Text>
        </View>
        <Pressable
          className="flex-row items-center gap-1.5 rounded-lg px-3 py-1.5"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <MaterialIcons name="delete" size={20} color="#BA1A1A" />
          <Text className="text-[12px] font-medium text-[#BA1A1A]">
            Delete
          </Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: topBarHeight + 16,
          paddingBottom: 100 + Math.max(insets.bottom, 8),
        }}
      >
        <View className="px-4">
          {/* Photos Section */}
          <View className="mb-6">
            <View className="mb-4 flex-row items-baseline justify-between">
              <Text className="text-[18px] font-semibold text-[#161D1A]">
                Photos
              </Text>
              <Text className="text-[12px] font-medium text-[#6C7A74]">
                Drag to reorder
              </Text>
            </View>
            <View className="flex-row gap-3">
              {/* Cover */}
              <View
                className="overflow-hidden rounded-xl border border-[#DDE4DF]"
                style={{
                  width: SIDE_IMAGE_SIZE * 2 + IMAGE_GAP,
                  height: SIDE_IMAGE_SIZE * 2 + IMAGE_GAP,
                }}
              >
                <Image
                  source={coverImage}
                  contentFit="cover"
                  className="h-full w-full"
                />
                <View className="absolute left-2 top-2 rounded-full bg-white/80 px-2 py-0.5">
                  <Text className="text-[10px] font-bold text-[#004535]">
                    COVER
                  </Text>
                </View>
                <Pressable className="absolute right-2 top-2 rounded-full bg-white/80 p-1.5">
                  <MaterialIcons name="close" size={16} color="#161D1A" />
                </Pressable>
              </View>
              {/* Side images */}
              <View style={{ gap: IMAGE_GAP }}>
                <View
                  className="overflow-hidden rounded-xl border border-[#DDE4DF]"
                  style={{
                    width: SIDE_IMAGE_SIZE,
                    height: SIDE_IMAGE_SIZE,
                  }}
                >
                  <Image
                    source={sideImage1}
                    contentFit="cover"
                    className="h-full w-full"
                  />
                  <Pressable className="absolute right-1.5 top-1.5 rounded-full bg-white/80 p-1">
                    <MaterialIcons name="close" size={14} color="#161D1A" />
                  </Pressable>
                </View>
                <View
                  className="overflow-hidden rounded-xl border border-[#DDE4DF]"
                  style={{
                    width: SIDE_IMAGE_SIZE,
                    height: SIDE_IMAGE_SIZE,
                  }}
                >
                  <Image
                    source={sideImage2}
                    contentFit="cover"
                    className="h-full w-full"
                  />
                  <Pressable className="absolute right-1.5 top-1.5 rounded-full bg-white/80 p-1">
                    <MaterialIcons name="close" size={14} color="#161D1A" />
                  </Pressable>
                </View>
              </View>
            </View>
            {/* Add more */}
            <Pressable
              className="mt-3 items-center justify-center rounded-xl border-2 border-dashed border-[#BBCAC3] bg-[#EFF5F0] py-4"
              style={({ pressed }) => ({
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <MaterialIcons name="add-a-photo" size={28} color="#006B55" />
              <Text className="mt-1 text-[12px] font-medium text-[#6C7A74]">
                Add more
              </Text>
            </Pressable>
          </View>

          {/* Pricing Section */}
          <View className="mb-6 rounded-2xl border border-[#DDE4DF] bg-white p-5">
            <Text className="text-[18px] font-semibold text-[#161D1A]">
              Pricing
            </Text>
            <Text className="mb-4 text-[14px] text-[#6C7A74]">
              Set a competitive price to sell faster.
            </Text>
            <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">
              Selling Price
            </Text>
            <View className="mb-4 h-12 flex-row items-center rounded-lg border border-[#BBCAC3] bg-[#EFF5F0] px-4">
              <Text className="mr-2 text-[20px] font-bold text-[#3C4A44]">
                ₹
              </Text>
              <TextInput
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
                className="flex-1 text-[20px] font-bold text-[#161D1A]"
                style={{ paddingVertical: 0 }}
              />
            </View>
            {/* Price Insight */}
            <View className="flex-row items-center justify-between rounded-lg bg-[rgba(39,187,151,0.1)] p-3">
              <View className="flex-row items-center gap-3">
                <MaterialIcons name="trending-up" size={22} color="#006B55" />
                <View>
                  <Text className="text-[12px] font-medium text-[#004535]">
                    Price Insight
                  </Text>
                  <Text className="text-[12px] text-[#004535]/80">
                    Similar sofas sell for ₹22k - ₹28k
                  </Text>
                </View>
              </View>
              <Text className="text-[12px] font-bold text-[#006B55]">FAIR</Text>
            </View>
          </View>

          {/* Details Section */}
          <View className="mb-6">
            <Text className="mb-4 px-1 text-[18px] font-semibold text-[#161D1A]">
              Details
            </Text>
            <View className="mb-4">
              <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">
                Title
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                className="rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[16px] text-[#161D1A]"
              />
            </View>
            <View className="mb-4">
              <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">
                Category
              </Text>
              <View className="h-12 flex-row items-center justify-between rounded-lg border border-[#BBCAC3] bg-white px-4">
                <Text className="text-[16px] text-[#161D1A]">Furniture</Text>
                <MaterialIcons
                  name="keyboard-arrow-down"
                  size={22}
                  color="#6C7A74"
                />
              </View>
            </View>
            <View>
              <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">
                Description
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                className="min-h-[120px] rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[16px] text-[#161D1A]"
              />
            </View>
          </View>

          {/* Location */}
          <View className="mb-6">
            <Text className="mb-4 px-1 text-[18px] font-semibold text-[#161D1A]">
              Location
            </Text>
            <View className="h-32 overflow-hidden rounded-xl border border-[#DDE4DF]">
              <Image
                source={mapImage}
                contentFit="cover"
                className="h-full w-full"
              />
              <View className="absolute inset-0 items-center justify-center bg-black/10">
                <View className="flex-row items-center gap-2 rounded-full border border-white/50 bg-white/90 px-4 py-2">
                  <MaterialIcons
                    name="location-on"
                    size={18}
                    color="#006B55"
                  />
                  <Text className="text-[12px] font-medium text-[#161D1A]">
                    Indiranagar, Bangalore
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Additional Info */}
          <View className="mb-6">
            <Text className="mb-4 px-1 text-[18px] font-semibold text-[#161D1A]">
              Additional Info
            </Text>
            <View className="flex-row gap-3">
              <View className="flex-1 rounded-xl border border-[#DDE4DF] bg-white p-4">
                <Text className="text-[12px] font-medium text-[#6C7A74]">
                  Condition
                </Text>
                <Text className="text-[16px] font-medium text-[#161D1A]">
                  Like New
                </Text>
              </View>
              <View className="flex-1 rounded-xl border border-[#DDE4DF] bg-white p-4">
                <Text className="text-[12px] font-medium text-[#6C7A74]">
                  Brand
                </Text>
                <Text className="text-[16px] font-medium text-[#161D1A]">
                  Custom Build
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View
        className="absolute inset-x-0 bottom-0 z-50 flex-row gap-3 border-t border-[#DDE4DF] bg-white/90 px-4 py-4"
        style={{ paddingBottom: Math.max(insets.bottom, 8) }}
      >
        <Pressable
          className="flex-1 items-center justify-center rounded-xl bg-[#E3EAE5] py-4"
          style={({ pressed }) => ({
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}
        >
          <Text className="text-[14px] font-medium text-[#161D1A]">
            Save as Draft
          </Text>
        </Pressable>
        <Pressable
          className="flex-[2] overflow-hidden rounded-xl"
          style={({ pressed }) => ({
            transform: [{ scale: pressed ? 0.98 : 1 }],
          })}
        >
          <LinearGradient
            colors={["#27BB97", "#1E9E7E"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{
              paddingVertical: 16,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text className="text-[18px] font-semibold text-white">
              Update Listing
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}
