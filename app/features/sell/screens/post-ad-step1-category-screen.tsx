import { MaterialIcons } from "@expo/vector-icons";
import { type Href, useLocalSearchParams, useRouter } from "@/lib/safe-router";
import { useCallback, useEffect, useState } from "react";
import { BackHandler, Pressable, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { SellFlowLayout, SellSectionCard } from "@/components/sell-flow-layout";
import { CATEGORY_MAP, type CategorySlug } from "@/constants/categories";
import { ListifyFonts } from "@/constants/typography";
import { useAppDispatch } from "@/store/hooks";
import {
  setCategory,
  setSubcategory as setSubcategoryAction,
} from "@/store/slices/post-form-slice";

const defaultCategorySlug: CategorySlug = "electronics";
const TEXT_PRIMARY = "#1A1A1A";
const TEXT_MUTED = "#6B7280";

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
  const dispatch = useAppDispatch();

  const categorySlug = getValidCategorySlug(params.category);
  const categoryConfig = CATEGORY_MAP[categorySlug];
  const subcategories = categoryConfig?.subcategories ?? [];

  const [selectedSubcategory, setSelectedSubcategoryLocal] = useState(
    subcategories[0] ?? "",
  );
  const [searchQuery, setSearchQuery] = useState("");

  const handleBack = useCallback(() => {
    router.replace("/sell-entry" as Href);
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        handleBack();
        return true;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onHardwareBack);
      return () => sub.remove();
    }, [handleBack]),
  );

  useEffect(() => {
    dispatch(setCategory(categorySlug));
    const firstSub = subcategories[0] ?? "";
    setSelectedSubcategoryLocal(firstSub);
    dispatch(setSubcategoryAction(firstSub));
  }, [categorySlug, dispatch, subcategories]);

  const handleSubcategorySelect = (sub: string) => {
    setSelectedSubcategoryLocal(sub);
    dispatch(setSubcategoryAction(sub));
  };

  const filteredSubcategories = searchQuery.trim()
    ? subcategories.filter((s) =>
        s.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : subcategories;

  return (
    <SellFlowLayout
      step={1}
      title={categoryConfig?.name ?? "Category"}
      subtitle="Choose a subcategory"
      onBack={handleBack}
      rightAction={
        <Pressable
          onPress={() => router.replace("/sell-entry")}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Text
            style={{
              fontFamily: ListifyFonts.medium,
              fontSize: 13,
              color: TEXT_MUTED,
            }}
          >
            Change
          </Text>
        </Pressable>
      }
      footerLabel="Selected"
      footerMeta={`${categoryConfig?.name} › ${selectedSubcategory}`}
      primaryLabel="Continue"
      onPrimaryPress={() => router.push("/post-ad-step2-details")}
    >
      {subcategories.length > 5 ? (
        <View
          style={{
            marginBottom: 16,
            height: 48,
            flexDirection: "row",
            alignItems: "center",
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            backgroundColor: "#FFFFFF",
            paddingHorizontal: 16,
          }}
        >
          <MaterialIcons name="search" size={20} color="#9CA3AF" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={`Search in ${categoryConfig?.name ?? "subcategories"}...`}
            placeholderTextColor="#9CA3AF"
            style={{
              flex: 1,
              marginLeft: 8,
              fontFamily: ListifyFonts.regular,
              fontSize: 14,
              color: TEXT_PRIMARY,
              paddingVertical: 0,
            }}
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
              <MaterialIcons name="close" size={18} color="#9CA3AF" />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <SellSectionCard>
        {filteredSubcategories.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 32 }}>
            <MaterialIcons name="search-off" size={36} color="#D1D5DB" />
            <Text
              style={{
                marginTop: 8,
                fontFamily: ListifyFonts.regular,
                fontSize: 14,
                color: TEXT_MUTED,
              }}
            >
              No subcategories match &quot;{searchQuery}&quot;
            </Text>
          </View>
        ) : null}
        {filteredSubcategories.map((sub, index) => {
          const isSelected = sub === selectedSubcategory;
          return (
            <Pressable
              key={sub}
              onPress={() => handleSubcategorySelect(sub)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 15,
                backgroundColor: pressed ? "#F9FAFB" : "#FFFFFF",
                borderBottomWidth:
                  index < filteredSubcategories.length - 1 ? 1 : 0,
                borderBottomColor: "#F3F4F6",
              })}
            >
              <Text
                style={{
                  flex: 1,
                  fontFamily: isSelected
                    ? ListifyFonts.semiBold
                    : ListifyFonts.regular,
                  fontSize: 15,
                  color: isSelected ? TEXT_PRIMARY : "#4B5563",
                }}
              >
                {sub}
              </Text>
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  borderWidth: 2,
                  borderColor: isSelected ? TEXT_PRIMARY : "#D1D5DB",
                  backgroundColor: isSelected ? TEXT_PRIMARY : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isSelected ? (
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: "#FFFFFF",
                    }}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </SellSectionCard>
    </SellFlowLayout>
  );
}
