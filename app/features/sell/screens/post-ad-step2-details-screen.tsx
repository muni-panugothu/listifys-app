import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "@/lib/safe-router";
import { useCallback, useMemo } from "react";
import { BackHandler, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  CONDITION_OPTIONS,
  CONDITION_SKIP_CATEGORIES,
  PRICE_OPTIONAL_CATEGORIES,
} from "@/constants/categories";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  setTitle,
  setDescription,
  setPrice,
  setCondition,
  setListingType,
  setBedrooms,
  setBathrooms,
  setFurnishing,
  setSquareFeet,
  toggleFeature,
  setPetFriendly,
} from "@/store/slices/post-form-slice";

const FURNISHING_OPTIONS = ["Fully Furnished", "Semi-Furnished", "Unfurnished"];
const PROPERTY_AMENITIES = [
  "Parking", "Swimming Pool", "Gym", "Power Backup", "Lift",
  "Security", "Garden", "Clubhouse", "Play Area", "Water Supply",
  "Gas Pipeline", "CCTV", "Intercom", "Fire Safety",
];

export function PostAdStep2DetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();

  const title = useAppSelector((s) => s.postForm.title);
  const description = useAppSelector((s) => s.postForm.description);
  const price = useAppSelector((s) => s.postForm.price);
  const condition = useAppSelector((s) => s.postForm.condition);
  const category = useAppSelector((s) => s.postForm.category);
  const listingType = useAppSelector((s) => s.postForm.listingType);
  const bedrooms = useAppSelector((s) => s.postForm.bedrooms);
  const bathrooms = useAppSelector((s) => s.postForm.bathrooms);
  const furnishing = useAppSelector((s) => s.postForm.furnishing);
  const squareFeet = useAppSelector((s) => s.postForm.squareFeet);
  const features = useAppSelector((s) => s.postForm.features);
  const petFriendly = useAppSelector((s) => s.postForm.petFriendly);

  const isProperty = category === "properties";

  const showCondition = !CONDITION_SKIP_CATEGORIES.includes(category);
  const priceOptional = PRICE_OPTIONAL_CATEGORIES.includes(category);

  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const priceError =
    !priceOptional &&
    price.length > 0 &&
    (Number(price) <= 100 || Number(price) === 0);

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
          <Text className="text-[18px] font-semibold tracking-tight text-[#0F172A]">
            Step 2 of 3
          </Text>
        </View>
        <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <Text className="text-[12px] font-semibold text-[#27BB97]">
            Save as Draft
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
          {/* Progress Bar */}
          <View className="mb-6 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <View className="h-full w-2/3 rounded-full bg-[#27BB97]" />
          </View>

          {/* Header */}
          <View className="mb-6">
            <Text className="text-[24px] font-bold tracking-tight text-[#0F172A]">
              Listing Details
            </Text>
            <Text className="mt-1 text-[14px] text-[#6C7A74]">
              Provide accurate details to help buyers find your item.
            </Text>
          </View>

          {/* Property Listing Type (Buy / Rent) */}
          {isProperty && (
            <View className="mb-6">
              <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">
                Listing Type
              </Text>
              <View className="rounded-xl bg-[#E9EFEB] p-1 flex-row">
                <Pressable
                  onPress={() => dispatch(setListingType("Properties"))}
                  className="flex-1 rounded-lg py-2.5"
                  style={{
                    backgroundColor: listingType === "Properties" ? "#FFFFFF" : "transparent",
                    shadowColor: listingType === "Properties" ? "#000" : "transparent",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: listingType === "Properties" ? 0.08 : 0,
                    shadowRadius: 2,
                    elevation: listingType === "Properties" ? 1 : 0,
                  }}
                >
                  <Text
                    className="text-center text-[14px] font-semibold"
                    style={{ color: listingType === "Properties" ? "#006B55" : "#6C7A74" }}
                  >
                    For Sale
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => dispatch(setListingType("Rentals"))}
                  className="flex-1 rounded-lg py-2.5"
                  style={{
                    backgroundColor: listingType === "Rentals" ? "#FFFFFF" : "transparent",
                    shadowColor: listingType === "Rentals" ? "#000" : "transparent",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: listingType === "Rentals" ? 0.08 : 0,
                    shadowRadius: 2,
                    elevation: listingType === "Rentals" ? 1 : 0,
                  }}
                >
                  <Text
                    className="text-center text-[14px] font-semibold"
                    style={{ color: listingType === "Rentals" ? "#006B55" : "#6C7A74" }}
                  >
                    For Rent
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Ad Title */}
          <View className="mb-6">
            <View className="mb-2 flex-row items-end justify-between">
              <Text className="text-[12px] font-medium text-[#161D1A]">
                Ad Title
              </Text>
              <Text className="text-[10px] font-medium text-[#6C7A74]">
                {title.length}/70
              </Text>
            </View>
            <TextInput
              value={title}
              onChangeText={(v) => dispatch(setTitle(v))}
              maxLength={70}
              placeholder="e.g. iPhone 13 Pro Max with box"
              placeholderTextColor="#94A3B8"
              className="h-12 rounded-lg border border-slate-200 bg-white px-4 text-[14px] text-[#161D1A]"
              style={{ paddingVertical: 0 }}
            />
          </View>

          {/* Description */}
          <View className="mb-6">
            <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">
              Description
            </Text>
            <TextInput
              value={description}
              onChangeText={(v) => dispatch(setDescription(v))}
              placeholder="Describe what you're selling, including features and any flaws..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className="min-h-30 rounded-lg border border-slate-200 bg-white p-4 text-[14px] text-[#161D1A]"
            />
            <Text className="mt-1 px-1 text-[11px] text-[#6C7A74]">
              Mention key selling points like brand, age, and condition details.
            </Text>
          </View>

          {/* Price */}
          <View className="mb-6">
            <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">
              Price
            </Text>
            <View
              className="h-12 flex-row items-center rounded-lg bg-white px-4"
              style={{
                borderWidth: 1,
                borderColor: priceError ? "#BA1A1A" : "#E2E8F0",
              }}
            >
              <Text className="mr-1 text-[16px] font-semibold text-[#161D1A]">
                ₹
              </Text>
              <TextInput
                value={price}
                onChangeText={(v) => dispatch(setPrice(v))}
                keyboardType="numeric"
                className="flex-1 text-[16px] font-bold text-[#161D1A]"
                style={{
                  paddingVertical: 0,
                  color: priceError ? "#BA1A1A" : "#161D1A",
                }}
              />
            </View>
            {priceError && (
              <View className="mt-1 flex-row items-center gap-1 px-1">
                <MaterialIcons name="error" size={14} color="#BA1A1A" />
                <Text className="text-[11px] text-[#BA1A1A]">
                  Price must be greater than ₹100
                </Text>
              </View>
            )}
          </View>

          {/* Condition */}
          {showCondition && (
          <View className="mb-8">
            <Text className="mb-3 text-[12px] font-medium text-[#161D1A]">
              Condition
            </Text>
            <View className="flex-row flex-wrap gap-3">
              {CONDITION_OPTIONS.map((opt) => {
                const isActive = condition === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => dispatch(setCondition(opt))}
                    className="rounded-full px-5 py-2.5"
                    style={{
                      backgroundColor: isActive ? "#27BB97" : "#FFFFFF",
                      borderWidth: 1,
                      borderColor: isActive ? "#27BB97" : "#E2E8F0",
                    }}
                  >
                    <Text
                      className="text-[12px] font-medium"
                      style={{ color: isActive ? "#FFFFFF" : "#161D1A" }}
                    >
                      {opt}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          )}

          {/* ── Property-Specific Fields ─────────────────────────── */}
          {isProperty && (
            <>
              {/* Bedrooms & Bathrooms */}
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">
                    Bedrooms
                  </Text>
                  <View className="h-12 flex-row items-center rounded-lg border border-slate-200 bg-white px-4">
                    <MaterialIcons name="bed" size={20} color="#6C7A74" />
                    <TextInput
                      value={bedrooms}
                      onChangeText={(v) => dispatch(setBedrooms(v.replace(/[^0-9]/g, "")))}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#94A3B8"
                      className="ml-2 flex-1 text-[14px] text-[#161D1A]"
                      style={{ paddingVertical: 0 }}
                    />
                  </View>
                </View>
                <View className="flex-1">
                  <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">
                    Bathrooms
                  </Text>
                  <View className="h-12 flex-row items-center rounded-lg border border-slate-200 bg-white px-4">
                    <MaterialIcons name="bathtub" size={20} color="#6C7A74" />
                    <TextInput
                      value={bathrooms}
                      onChangeText={(v) => dispatch(setBathrooms(v.replace(/[^0-9]/g, "")))}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#94A3B8"
                      className="ml-2 flex-1 text-[14px] text-[#161D1A]"
                      style={{ paddingVertical: 0 }}
                    />
                  </View>
                </View>
              </View>

              {/* Area (sq.ft) */}
              <View className="mb-6">
                <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">
                  Area (sq.ft)
                </Text>
                <View className="h-12 flex-row items-center rounded-lg border border-slate-200 bg-white px-4">
                  <MaterialIcons name="square-foot" size={20} color="#6C7A74" />
                  <TextInput
                    value={squareFeet}
                    onChangeText={(v) => dispatch(setSquareFeet(v.replace(/[^0-9]/g, "")))}
                    keyboardType="numeric"
                    placeholder="e.g. 1200"
                    placeholderTextColor="#94A3B8"
                    className="ml-2 flex-1 text-[14px] text-[#161D1A]"
                    style={{ paddingVertical: 0 }}
                  />
                </View>
              </View>

              {/* Furnishing */}
              <View className="mb-6">
                <Text className="mb-3 text-[12px] font-medium text-[#161D1A]">
                  Furnishing
                </Text>
                <View className="flex-row flex-wrap gap-3">
                  {FURNISHING_OPTIONS.map((opt) => {
                    const isActive = furnishing === opt;
                    return (
                      <Pressable
                        key={opt}
                        onPress={() => dispatch(setFurnishing(isActive ? "" : opt))}
                        className="rounded-full px-5 py-2.5"
                        style={{
                          backgroundColor: isActive ? "#27BB97" : "#FFFFFF",
                          borderWidth: 1,
                          borderColor: isActive ? "#27BB97" : "#E2E8F0",
                        }}
                      >
                        <Text
                          className="text-[12px] font-medium"
                          style={{ color: isActive ? "#FFFFFF" : "#161D1A" }}
                        >
                          {opt}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Pet Friendly */}
              <View className="mb-6">
                <Text className="mb-3 text-[12px] font-medium text-[#161D1A]">
                  Pet Friendly
                </Text>
                <View className="flex-row gap-3">
                  {[true, false].map((val) => {
                    const isActive = petFriendly === val;
                    return (
                      <Pressable
                        key={String(val)}
                        onPress={() => dispatch(setPetFriendly(val))}
                        className="rounded-full px-6 py-2.5"
                        style={{
                          backgroundColor: isActive ? "#27BB97" : "#FFFFFF",
                          borderWidth: 1,
                          borderColor: isActive ? "#27BB97" : "#E2E8F0",
                        }}
                      >
                        <Text
                          className="text-[12px] font-medium"
                          style={{ color: isActive ? "#FFFFFF" : "#161D1A" }}
                        >
                          {val ? "Yes" : "No"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Amenities */}
              <View className="mb-8">
                <Text className="mb-3 text-[12px] font-medium text-[#161D1A]">
                  Amenities
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {PROPERTY_AMENITIES.map((amenity) => {
                    const isActive = features.includes(amenity);
                    return (
                      <Pressable
                        key={amenity}
                        onPress={() => dispatch(toggleFeature(amenity))}
                        className="flex-row items-center gap-1.5 rounded-full px-4 py-2"
                        style={{
                          backgroundColor: isActive ? "rgba(39,187,151,0.1)" : "#FFFFFF",
                          borderWidth: 1,
                          borderColor: isActive ? "#27BB97" : "#E2E8F0",
                        }}
                      >
                        <MaterialIcons
                          name={isActive ? "check-circle" : "add-circle-outline"}
                          size={16}
                          color={isActive ? "#27BB97" : "#94A3B8"}
                        />
                        <Text
                          className="text-[12px] font-medium"
                          style={{ color: isActive ? "#006B55" : "#161D1A" }}
                        >
                          {amenity}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </>
          )}

          {/* Tip Box */}
          <View className="flex-row gap-4 rounded-xl border border-slate-100 bg-white/70 p-4">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-[rgba(39,187,151,0.1)]">
              <MaterialIcons name="lightbulb" size={22} color="#27BB97" />
            </View>
            <View className="flex-1">
              <Text className="mb-1 text-[12px] font-semibold text-[#0F172A]">
                Seller Pro-Tip
              </Text>
              <Text className="text-[12px] leading-5 text-[#6C7A74]">
                Ads with a clear title and fair pricing receive 3x more
                inquiries. Consider checking similar listings to stay
                competitive.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View
        className="absolute inset-x-0 bottom-0 z-50 flex-row items-center justify-between border-t border-slate-100 bg-white px-4"
        style={{
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 16,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.05,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <View>
          <Text className="text-[10px] font-bold uppercase tracking-wider text-[#6C7A74]">
            Estimated Reach
          </Text>
          <Text className="text-[16px] font-bold text-[#0F172A]">
            ~2.5k views/week
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/post-ad-step3-media")}
          style={({ pressed }) => ({
            transform: [{ scale: pressed ? 0.95 : 1 }],
          })}
        >
          <LinearGradient
            colors={["#27BB97", "#1E9E7E"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{
              height: 48,
              paddingHorizontal: 32,
              borderRadius: 8,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text className="text-[14px] font-bold text-white">Next</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}
