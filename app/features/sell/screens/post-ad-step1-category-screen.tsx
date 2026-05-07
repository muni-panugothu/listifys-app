import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Image } from "@/lib/nativewind-interop";

type Category = {
  id: string;
  title: string;
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
};

type Subcategory = {
  id: string;
  title: string;
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
};

type CategoryId =
  | "electronics"
  | "vehicles"
  | "property"
  | "fashion"
  | "home"
  | "jobs"
  | "furniture";

const categories: Array<Category & { id: CategoryId }> = [
  { id: "electronics", title: "Electronics", icon: "devices" },
  { id: "vehicles", title: "Vehicles", icon: "directions-car" },
  { id: "property", title: "Property", icon: "home" },
  { id: "fashion", title: "Fashion", icon: "checkroom" },
  { id: "home", title: "Home", icon: "chair" },
  { id: "jobs", title: "Jobs", icon: "work" },
  { id: "furniture", title: "Furniture", icon: "chair" },
];

const subcategoriesMap: Record<CategoryId, Subcategory[]> = {
  electronics: [
    { id: "laptops", title: "Laptops & Computers", icon: "laptop-mac" },
    { id: "phones", title: "Mobile Phones", icon: "smartphone" },
    { id: "cameras", title: "Cameras & Photography", icon: "camera" },
    { id: "audio", title: "Audio & Accessories", icon: "headphones" },
    { id: "tv", title: "TV & Video Equipment", icon: "tv" },
  ],
  vehicles: [
    { id: "cars", title: "Cars", icon: "directions-car" },
    { id: "bikes", title: "Motorcycles", icon: "two-wheeler" },
    { id: "parts", title: "Vehicle Parts", icon: "build" },
  ],
  property: [
    { id: "apartments", title: "Apartments", icon: "apartment" },
    { id: "houses", title: "Houses & Villas", icon: "home" },
    { id: "commercial", title: "Commercial Space", icon: "store" },
  ],
  fashion: [
    { id: "menswear", title: "Men's Fashion", icon: "checkroom" },
    { id: "womenswear", title: "Women's Fashion", icon: "style" },
    { id: "accessories", title: "Accessories", icon: "watch" },
  ],
  home: [
    { id: "furniture", title: "Furniture", icon: "chair" },
    { id: "appliances", title: "Home Appliances", icon: "kitchen" },
    { id: "decor", title: "Home Decor", icon: "light" },
  ],
  jobs: [
    { id: "full-time", title: "Full-Time Jobs", icon: "badge" },
    { id: "part-time", title: "Part-Time Jobs", icon: "schedule" },
    { id: "freelance", title: "Freelance Gigs", icon: "laptop" },
  ],
  furniture: [
    { id: "sofas", title: "Sofas & Couches", icon: "chair" },
    { id: "tables", title: "Tables & Desks", icon: "table-restaurant" },
    { id: "beds", title: "Beds & Mattresses", icon: "bed" },
  ],
};

const defaultCategoryId: CategoryId = "electronics";

const getCategoryParam = (value?: string | string[]) =>
  typeof value === "string" ? value : value?.[0];

const getValidCategoryId = (value?: string | string[]): CategoryId => {
  const categoryId = getCategoryParam(value);

  if (categories.some((category) => category.id === categoryId)) {
    return categoryId as CategoryId;
  }

  return defaultCategoryId;
};

const featuredBannerImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDqm29wPN47CqCaKKRW4RaY6lmrRz-UsgdBsk160WYD1oUifwnwMfpUf-l7_mgN_ZWSZfpvIzQAj3UxOQ9bH5GIplKBHlapSr_FQUDjag4shYNt9B_ta4fUyPh826ohA333SKCyzn-Wxbq-UL-gCFj3paZfwkFPSibvj_uYvH9fTcOXZpg7l_tS9QczWTfsYPLvnLNGZoxqpVa-Qta8VUrPAx6Lj5qYvnkYQmYCAUNIMYUHoymdweQKimVLE-0uOJ2cWKsBqWFNLO8";

export function PostAdStep1CategoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const initialCategoryId = getValidCategoryId(params.category);
  const [selectedCategory, setSelectedCategory] = useState(initialCategoryId);
  const [selectedSubcategory, setSelectedSubcategory] = useState(
    subcategoriesMap[initialCategoryId]?.[0]?.id ?? ""
  );
  const [searchQuery, setSearchQuery] = useState("");

  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const subcategories = subcategoriesMap[selectedCategory] ?? [];
  const selectedSubLabel =
    subcategories.find((s) => s.id === selectedSubcategory)?.title ?? "";

  useEffect(() => {
    const nextCategoryId = getValidCategoryId(params.category);

    setSelectedCategory(nextCategoryId);
    setSelectedSubcategory(subcategoriesMap[nextCategoryId]?.[0]?.id ?? "");
  }, [params.category]);

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
            onPress={() => router.back()}
            className="h-9 w-9 items-center justify-center rounded-full"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons name="arrow-back" size={23} color="#0F172A" />
          </Pressable>
          <Text className="text-[18px] font-semibold tracking-tight text-[#0F172A]">
            Step 1 of 3
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
          {/* Header */}
          <View className="mb-6">
            <Text className="mb-2 text-[24px] font-bold tracking-tight text-[#161D1A]">
              Choose category
            </Text>
            <Text className="mb-6 text-[14px] leading-5 text-[#6C7A74]">
              Select a category that best describes what you are selling.
            </Text>
            {/* Search */}
            <View className="h-12 flex-row items-center rounded-lg border border-slate-200 bg-white px-4">
              <MaterialIcons name="search" size={22} color="#6C7A74" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search categories (e.g. iPhone, Sofa)"
                placeholderTextColor="#94A3B8"
                className="ml-2 flex-1 text-[14px] text-[#161D1A]"
                style={{ paddingVertical: 0 }}
              />
            </View>
          </View>

          {/* Category Grid */}
          <View className="mb-8 gap-3">
            {categories.map((cat) => {
              const isSelected = cat.id === selectedCategory;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => {
                    setSelectedCategory(cat.id);
                    const subs = subcategoriesMap[cat.id];
                    if (subs?.length) setSelectedSubcategory(subs[0].id);
                  }}
                  className="flex-row items-center rounded-xl bg-white p-4"
                  style={{
                    borderWidth: isSelected ? 2 : 1,
                    borderColor: isSelected ? "#27BB97" : "#F1F5F9",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 3,
                    elevation: 1,
                  }}
                >
                  <View
                    className="mr-4 h-12 w-12 items-center justify-center rounded-lg"
                    style={{
                      backgroundColor: isSelected
                        ? "rgba(39,187,151,0.1)"
                        : "#EEF7F3",
                    }}
                  >
                    <MaterialIcons
                      name={cat.icon}
                      size={24}
                      color={isSelected ? "#27BB97" : "#3C4A44"}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[18px] font-semibold text-[#161D1A]">
                      {cat.title}
                    </Text>
                    {isSelected && (
                      <Text className="text-[12px] font-medium text-[#27BB97]">
                        Selected
                      </Text>
                    )}
                  </View>
                  {isSelected && (
                    <MaterialIcons
                      name="check-circle"
                      size={24}
                      color="#27BB97"
                    />
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Subcategories */}
          <View className="mb-8 overflow-hidden rounded-2xl border border-slate-100 bg-white">
            <View className="border-b border-slate-50 px-4 py-3">
              <Text className="text-[12px] font-medium uppercase tracking-wider text-[#6C7A74]">
                Subcategories in{" "}
                {categories.find((c) => c.id === selectedCategory)?.title}
              </Text>
            </View>
            {subcategories.map((sub) => {
              const isSelected = sub.id === selectedSubcategory;
              return (
                <Pressable
                  key={sub.id}
                  onPress={() => setSelectedSubcategory(sub.id)}
                  className="flex-row items-center border-b border-slate-50 px-4 py-4"
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? "#EFF5F0" : "transparent",
                  })}
                >
                  <View className="mr-4 h-10 w-10 items-center justify-center rounded-full bg-slate-50">
                    <MaterialIcons name={sub.icon} size={22} color="#3C4A44" />
                  </View>
                  <Text className="flex-1 text-[16px] text-[#161D1A]">
                    {sub.title}
                  </Text>
                  <View
                    className="h-5 w-5 items-center justify-center rounded-full border-2"
                    style={{
                      borderColor: isSelected ? "#27BB97" : "#CBD5E1",
                      backgroundColor: isSelected ? "#27BB97" : "transparent",
                    }}
                  >
                    {isSelected && (
                      <View className="h-2 w-2 rounded-full bg-white" />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Featured Banner */}
          <View className="mb-8 h-40 overflow-hidden rounded-2xl">
            <Image
              source={featuredBannerImage}
              contentFit="cover"
              transition={200}
              className="h-full w-full"
            />
            <LinearGradient
              colors={["rgba(0,69,53,0.8)", "transparent"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ position: "absolute", inset: 0 }}
            />
            <View className="absolute inset-0 justify-center px-6">
              <Text className="mb-1 text-[12px] font-medium text-white/80">
                Selling Business Assets?
              </Text>
              <Text className="mb-2 text-[20px] font-semibold text-white">
                List in Enterprise Category
              </Text>
              <Pressable className="self-start rounded-full border border-white/30 bg-white/20 px-4 py-1.5">
                <Text className="text-[12px] font-medium text-white">
                  Explore Pro Tools
                </Text>
              </Pressable>
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
        <View className="flex-1">
          <Text className="text-[12px] text-[#6C7A74]">
            Selected:{" "}
            <Text className="font-bold text-[#161D1A]">
              {selectedSubLabel}
            </Text>
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
              paddingHorizontal: 40,
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
