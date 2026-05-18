import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "@/lib/safe-router";
import { useCallback, useMemo } from "react";
import {
  BackHandler,
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FLOATING_BOTTOM_NAV_OFFSET } from "@/constants/bottom-nav-tabs";
import { CATEGORIES, type CategorySlug } from "@/constants/categories";
import { APP_SCREEN_BG } from "@/constants/theme";
import { ListifyFonts } from "@/constants/typography";
import { Image } from "@/lib/nativewind-interop";
import { useTabNavigation } from "@/lib/use-tab-navigation";
import { useAppDispatch } from "@/store/hooks";
import { setCategory } from "@/store/slices/post-form-slice";

const BRAND = "#27BB97";
const BRAND_DARK = "#1D9477";
const HOME_BG = APP_SCREEN_BG;
const TEXT_PRIMARY = "#1A1A1A";
const TEXT_MUTED = "#6B7280";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const H_PADDING = 20;
const GRID_GAP = 12;
const GRID_COLS = 2;
const GRID_CARD_WIDTH =
  (SCREEN_WIDTH - H_PADDING * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
const TIP_COLS = 3;
const TIP_GAP = 10;
const TIP_CARD_WIDTH =
  (SCREEN_WIDTH - H_PADDING * 2 - TIP_GAP * (TIP_COLS - 1)) / TIP_COLS;
const FEATURED_CARD_WIDTH = 132;
const FEATURED_CARD_HEIGHT = 156;

const FEATURED_SLUGS: CategorySlug[] = [
  "electronics",
  "vehicles",
  "mobiles",
  "forsale",
  "properties",
  "fashion",
];

const CATEGORY_IMAGES: Record<CategorySlug, string> = {
  electronics:
    "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400&h=400&fit=crop&q=80",
  jobs: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=400&h=400&fit=crop&q=80",
  vehicles:
    "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=400&h=400&fit=crop&q=80",
  takecare:
    "https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=400&h=400&fit=crop&q=80",
  events:
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&h=400&fit=crop&q=80",
  properties:
    "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=400&fit=crop&q=80",
  forsale:
    "https://images.unsplash.com/photo-1607082349566-187342175e2f?w=400&h=400&fit=crop&q=80",
  mobiles:
    "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=400&fit=crop&q=80",
  furniture:
    "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=400&fit=crop&q=80",
  fashion:
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&h=400&fit=crop&q=80",
  sports:
    "https://images.unsplash.com/photo-1461896836934-bd45ba48bf1d?w=400&h=400&fit=crop&q=80",
  collectibles:
    "https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=400&h=400&fit=crop&q=80",
  pets: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=400&fit=crop&q=80",
  books:
    "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&h=400&fit=crop&q=80",
  beauty:
    "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&h=400&fit=crop&q=80",
  others:
    "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=400&h=400&fit=crop&q=80",
  toys: "https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=400&h=400&fit=crop&q=80",
};

const POST_STEPS = [
  { step: 1, label: "Category" },
  { step: 2, label: "Details" },
  { step: 3, label: "Publish" },
];

const TRUST_POINTS = [
  { icon: "verified" as const, label: "Free to list" },
  { icon: "groups" as const, label: "Local buyers" },
  { icon: "bolt" as const, label: "Live in minutes" },
];

const SELL_TIPS = [
  {
    icon: "photo-camera" as const,
    title: "Great photos",
    text: "Natural light, every angle.",
  },
  {
    icon: "edit-note" as const,
    title: "Clear details",
    text: "Brand, condition, inclusions.",
  },
  {
    icon: "sell" as const,
    title: "Fair pricing",
    text: "Match similar listings.",
  },
];

type SellCategory = {
  slug: CategorySlug;
  title: string;
  image: string;
};

const allCategories: SellCategory[] = CATEGORIES.map((c) => ({
  slug: c.slug,
  title: c.name,
  image: CATEGORY_IMAGES[c.slug],
}));

const featuredCategories = FEATURED_SLUGS.map(
  (slug) => allCategories.find((c) => c.slug === slug)!,
).filter(Boolean);

function StepIndicator() {
  return (
    <View className="flex-row items-center justify-between rounded-2xl bg-white px-4 py-3.5">
      {POST_STEPS.map((item, index) => (
        <View key={item.step} className="flex-1 flex-row items-center">
          <View
            className="h-8 w-8 items-center justify-center rounded-full"
            style={{
              backgroundColor: index === 0 ? BRAND : "#E5E7EB",
            }}
          >
            <Text
              className="text-[13px]"
              style={{
                fontFamily: ListifyFonts.bold,
                color: index === 0 ? "#FFFFFF" : "#9CA3AF",
              }}
            >
              {item.step}
            </Text>
          </View>
          <Text
            className="ml-2 text-[12px]"
            style={{
              fontFamily: index === 0 ? ListifyFonts.semiBold : ListifyFonts.medium,
              color: index === 0 ? TEXT_PRIMARY : TEXT_MUTED,
            }}
          >
            {item.label}
          </Text>
          {index < POST_STEPS.length - 1 ? (
            <View
              className="mx-2 h-px flex-1"
              style={{ backgroundColor: "#E5E7EB", minWidth: 8 }}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

function FeaturedCategoryCard({
  category,
  onPress,
}: {
  category: SellCategory;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: FEATURED_CARD_WIDTH,
        height: FEATURED_CARD_HEIGHT,
        marginRight: 12,
        opacity: pressed ? 0.92 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View className="h-full w-full overflow-hidden rounded-2xl">
        <Image
          source={category.image}
          contentFit="cover"
          className="h-full w-full"
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.75)"]}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "55%",
          }}
        />
        <View className="absolute bottom-0 left-0 right-0 px-3 pb-3">
          <Text
            className="text-[14px] text-white"
            style={{ fontFamily: ListifyFonts.semiBold }}
            numberOfLines={2}
          >
            {category.title}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function GridCategoryCard({
  category,
  onPress,
}: {
  category: SellCategory;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: GRID_CARD_WIDTH,
        opacity: pressed ? 0.92 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
    >
      <View
        className="overflow-hidden rounded-2xl bg-white"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 3,
        }}
      >
        <View style={{ height: GRID_CARD_WIDTH * 0.72 }}>
          <Image
            source={category.image}
            contentFit="cover"
            className="h-full w-full"
          />
        </View>
        <View className="flex-row items-center justify-between px-3 py-3">
          <Text
            className="flex-1 text-[15px]"
            style={{ fontFamily: ListifyFonts.semiBold, color: TEXT_PRIMARY }}
            numberOfLines={1}
          >
            {category.title}
          </Text>
          <MaterialIcons name="chevron-right" size={20} color="#D1D5DB" />
        </View>
      </View>
    </Pressable>
  );
}

function SellTipCard({ tip }: { tip: (typeof SELL_TIPS)[number] }) {
  return (
    <View
      style={{
        width: TIP_CARD_WIDTH,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
      }}
    >
      <View className="items-center rounded-2xl bg-white px-2.5 pb-3.5 pt-4">
        <View
          className="mb-2.5 h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: "rgba(39,187,151,0.12)" }}
        >
          <MaterialIcons name={tip.icon} size={20} color={BRAND} />
        </View>
        <Text
          className="text-center text-[12px]"
          style={{ fontFamily: ListifyFonts.semiBold, color: TEXT_PRIMARY }}
          numberOfLines={2}
        >
          {tip.title}
        </Text>
        <Text
          className="mt-1 text-center text-[10px] leading-[14px]"
          style={{ fontFamily: ListifyFonts.regular, color: TEXT_MUTED }}
          numberOfLines={3}
        >
          {tip.text}
        </Text>
      </View>
    </View>
  );
}

export function SellEntryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const handleBottomTabPress = useTabNavigation();

  const bottomPadding = useMemo(
    () => FLOATING_BOTTOM_NAV_OFFSET + Math.max(insets.bottom, 10) + 16,
    [insets.bottom],
  );

  const openCategoryFlow = useCallback(
    (slug: CategorySlug) => {
      dispatch(setCategory(slug));
      router.push({
        pathname: "/post-ad-step1-category",
        params: { category: slug },
      });
    },
    [dispatch, router],
  );

  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        handleBottomTabPress("home");
        return true;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onHardwareBack);
      return () => sub.remove();
    }, [handleBottomTabPress]),
  );

  return (
    <View className="flex-1" style={{ backgroundColor: HOME_BG }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: bottomPadding,
        }}
      >
        <View style={{ paddingHorizontal: H_PADDING }}>
          <View className="mb-5 flex-row items-center">
            <Pressable
              onPress={() => handleBottomTabPress("home")}
              hitSlop={12}
              className="mr-1 h-10 w-10 items-center justify-center"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <MaterialIcons name="chevron-left" size={32} color={TEXT_PRIMARY} />
            </Pressable>
            {/* <View className="flex-1">
              <Text
                className="text-[20px]"
                style={{ fontFamily: ListifyFonts.bold, color: TEXT_PRIMARY }}
              >
                Start selling
              </Text>
              <Text
                className=" text-[12px]"
                style={{ fontFamily: ListifyFonts.regular, color: TEXT_MUTED }}
              >
                Choose a category to create your listing
              </Text>
            </View> */}

<Text
            className=" text-[19px]"
            style={{ fontFamily: ListifyFonts.bold, color: TEXT_PRIMARY }}
          >
            Sell smarter
          </Text>
          </View>


      
          <View
            className="mb-5 flex-row"
            style={{ gap: TIP_GAP }}
          >
            {SELL_TIPS.map((tip) => (
              <SellTipCard key={tip.title} tip={tip} />
            ))}
          </View>


          <View className="mb-6">
            <StepIndicator />
          </View>

          <Text
            className="mb-3 text-[18px]"
            style={{ fontFamily: ListifyFonts.bold, color: TEXT_PRIMARY }}
          >
            Popular categories
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingLeft: H_PADDING,
            paddingRight: H_PADDING - 12,
            paddingBottom: 4,
          }}
          className="mb-6"
        >
          {featuredCategories.map((category) => (
            <FeaturedCategoryCard
              key={category.slug}
              category={category}
              onPress={() => openCategoryFlow(category.slug)}
            />
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: H_PADDING }}>
          <Text
            className="mb-3 text-[18px]"
            style={{ fontFamily: ListifyFonts.bold, color: TEXT_PRIMARY }}
          >
            All categories
          </Text>

          <View
            className="mb-6 flex-row flex-wrap"
            style={{ columnGap: GRID_GAP, rowGap: GRID_GAP }}
          >
            {allCategories.map((category) => (
              <GridCategoryCard
                key={category.slug}
                category={category}
                onPress={() => openCategoryFlow(category.slug)}
              />
            ))}
          </View>

          <Pressable
            onPress={() => router.push("/my-listings-active")}
            className="mt-2 flex-row items-center justify-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white py-4"
            style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
          >
            <MaterialIcons name="inventory-2" size={20} color={BRAND} />
            <Text
              className="text-[15px]"
              style={{ fontFamily: ListifyFonts.semiBold, color: BRAND }}
            >
              View my listings
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
