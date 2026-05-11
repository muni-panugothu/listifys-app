import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useLocalSearchParams, useRouter } from "@/lib/safe-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BackHandler, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CATEGORY_MAP, type CategorySlug } from "@/constants/categories";
import { useAppDispatch } from "@/store/hooks";
import { setCategory, setSubcategory as setSubcategoryAction } from "@/store/slices/post-form-slice";

const defaultCategorySlug: CategorySlug = "electronics";

const getCategoryParam = (value?: string | string[]) =>
  typeof value === "string" ? value : value?.[0];

const getValidCategorySlug = (value?: string | string[]): CategorySlug => {
  const slug = getCategoryParam(value);
  if (slug && slug in CATEGORY_MAP) return slug as CategorySlug;
  return defaultCategorySlug;
};

export function PostAdStep1CategoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();

  const categorySlug = getValidCategorySlug(params.category);
  const categoryConfig = CATEGORY_MAP[categorySlug];
  const subcategories = categoryConfig?.subcategories ?? [];

  const [selectedSubcategory, setSelectedSubcategoryLocal] = useState(
    subcategories[0] ?? "",
  );
  const [searchQuery, setSearchQuery] = useState("");

  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);

  const handleBack = () => {
    router.replace("/sell-entry" as Href);
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

  // Sync category to redux on mount / param change
  useEffect(() => {
    dispatch(setCategory(categorySlug));
    const firstSub = subcategories[0] ?? "";
    setSelectedSubcategoryLocal(firstSub);
    dispatch(setSubcategoryAction(firstSub));
  }, [categorySlug, dispatch]);

  const handleSubcategorySelect = (sub: string) => {
    setSelectedSubcategoryLocal(sub);
    dispatch(setSubcategoryAction(sub));
  };

  // Filter subcategories by search
  const filteredSubcategories = searchQuery.trim()
    ? subcategories.filter((s) =>
        s.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : subcategories;

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
            Step 1 of 3
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/sell-entry")}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Text className="text-[12px] font-semibold text-[#27BB97]">
            Change Category
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
          {/* Selected Category Header */}
          <View className="mb-6">
            <Text className="mb-1 text-[12px] font-medium uppercase tracking-wider text-[#6C7A74]">
              Category
            </Text>
            <View
              className="flex-row items-center rounded-2xl bg-white p-4"
              style={{
                borderWidth: 2,
                borderColor: "#27BB97",
                shadowColor: "#27BB97",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
                elevation: 3,
              }}
            >
              <View className="mr-4 h-12 w-12 items-center justify-center rounded-xl bg-[#D7F8EF]">
                <MaterialIcons
                  name={categoryConfig?.icon ?? "category"}
                  size={26}
                  color="#27BB97"
                />
              </View>
              <View className="flex-1">
                <Text className="text-[20px] font-bold text-[#161D1A]">
                  {categoryConfig?.name ?? "Category"}
                </Text>
                <Text className="text-[12px] text-[#6C7A74]">
                  {subcategories.length} subcategories available
                </Text>
              </View>
              <MaterialIcons name="check-circle" size={24} color="#27BB97" />
            </View>
          </View>

          {/* Subcategory Selection */}
          <View className="mb-4">
            <Text className="mb-2 text-[22px] font-bold tracking-tight text-[#161D1A]">
              Select subcategory
            </Text>
            <Text className="mb-5 text-[14px] leading-5 text-[#6C7A74]">
              Pick the subcategory that best matches your listing.
            </Text>

            {/* Search subcategories */}
            {subcategories.length > 5 && (
              <View className="mb-4 h-12 flex-row items-center rounded-xl border border-slate-200 bg-white px-4">
                <MaterialIcons name="search" size={20} color="#6C7A74" />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={`Search in ${categoryConfig?.name ?? "subcategories"}...`}
                  placeholderTextColor="#94A3B8"
                  className="ml-2 flex-1 text-[14px] text-[#161D1A]"
                  style={{ paddingVertical: 0 }}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery("")}>
                    <MaterialIcons name="close" size={18} color="#94A3B8" />
                  </Pressable>
                )}
              </View>
            )}
          </View>

          {/* Subcategory List */}
          <View className="mb-8 overflow-hidden rounded-2xl border border-slate-100 bg-white">
            {filteredSubcategories.length === 0 && (
              <View className="items-center py-8">
                <MaterialIcons name="search-off" size={36} color="#CBD5E1" />
                <Text className="mt-2 text-[14px] text-[#6C7A74]">
                  No subcategories match "{searchQuery}"
                </Text>
              </View>
            )}
            {filteredSubcategories.map((sub, index) => {
              const isSelected = sub === selectedSubcategory;
              return (
                <Pressable
                  key={sub}
                  onPress={() => handleSubcategorySelect(sub)}
                  className="flex-row items-center px-4 py-4"
                  style={({ pressed }) => ({
                    backgroundColor: isSelected
                      ? "rgba(39,187,151,0.06)"
                      : pressed
                        ? "#F8FAF9"
                        : "transparent",
                    borderBottomWidth: index < filteredSubcategories.length - 1 ? 1 : 0,
                    borderBottomColor: "#F1F5F9",
                  })}
                >
                  <View
                    className="mr-3 h-9 w-9 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: isSelected ? "#D7F8EF" : "#F4F7F5",
                    }}
                  >
                    <MaterialIcons
                      name={isSelected ? "check" : "label-outline"}
                      size={18}
                      color={isSelected ? "#27BB97" : "#94A3B8"}
                    />
                  </View>
                  <Text
                    className="flex-1 text-[15px]"
                    style={{
                      color: isSelected ? "#161D1A" : "#3C4A44",
                      fontWeight: isSelected ? "600" : "400",
                    }}
                  >
                    {sub}
                  </Text>
                  <View
                    className="h-5.5 w-5.5 items-center justify-center rounded-full border-2"
                    style={{
                      borderColor: isSelected ? "#27BB97" : "#CBD5E1",
                      backgroundColor: isSelected ? "#27BB97" : "transparent",
                    }}
                  >
                    {isSelected && (
                      <View className="h-2.5 w-2.5 rounded-full bg-white" />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Tip Card */}
          <View className="mb-8 flex-row items-start gap-3 rounded-2xl bg-[#E8F7F1] px-4 py-4">
            <MaterialIcons name="lightbulb-outline" size={20} color="#27BB97" />
            <View className="flex-1">
              <Text className="mb-1 text-[13px] font-semibold text-[#161D1A]">
                Tip: Choose the right subcategory
              </Text>
              <Text className="text-[12px] leading-4.5 text-[#6C7A74]">
                Listings in the correct subcategory get up to 3x more views and
                sell faster.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Fixed Footer */}
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
        <View className="flex-1 mr-3">
          <Text className="text-[11px] text-[#6C7A74]">Selected</Text>
          <Text numberOfLines={1} className="text-[14px] font-bold text-[#161D1A]">
            {categoryConfig?.name} › {selectedSubcategory}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/post-ad-step2-details")}
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
              paddingHorizontal: 36,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 6,
            }}
          >
            <Text className="text-[14px] font-bold text-white">Next</Text>
            <MaterialIcons name="arrow-forward" size={18} color="#FFF" />
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}
