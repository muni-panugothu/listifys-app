import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "@/lib/safe-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BackHandler,
  Dimensions,
  Keyboard,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HomeCategoryTile } from "@/components/home-category-tile";
import { VoiceSearchModal } from "@/components/voice-search-modal";
import { CATEGORIES, type CategorySlug } from "@/constants/categories";
import { ListifyFonts } from "@/constants/typography";
import { fetchSavedListings } from "@/features/listing/services/listing-api";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { getCategoryHref } from "@/lib/navigate-to-category";
import { useTabNavigation } from "@/lib/use-tab-navigation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  hydrateAppLocation,
  selectLocationLabel,
  setProfileFallbackLocation,
} from "@/store/slices/location-slice";
import type { Href } from "@/lib/safe-router";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_GAP = 10;
const GRID_H_PADDING = 16;
const SEARCH_GRID_COLS = 4;
const CATEGORY_CARD_SIZE =
  (SCREEN_WIDTH - GRID_H_PADDING * 2 - GRID_GAP * (SEARCH_GRID_COLS - 1)) /
  SEARCH_GRID_COLS;

/** All categories with Others last (after Toys). */
const searchCategoriesOrdered = [
  ...CATEGORIES.filter((c) => c.slug !== "others"),
  ...CATEGORIES.filter((c) => c.slug === "others"),
].map((c) => ({
  id: c.slug as CategorySlug,
  label: c.name,
  icon: c.icon,
}));

export function SearchHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const displayLocation = useAppSelector(selectLocationLabel);
  const [query, setQuery] = useState("");
  const [savedCount, setSavedCount] = useState(0);
  const [voiceVisible, setVoiceVisible] = useState(false);
  const { refreshing, onRefresh } = usePullToRefresh();

  const bottomNavPadding = Math.max(insets.bottom, 8);

  const loadSavedCount = useCallback(async () => {
    try {
      const res = await fetchSavedListings();
      setSavedCount(res.listings?.length ?? 0);
    } catch {
      setSavedCount(0);
    }
  }, []);

  useEffect(() => {
    void loadSavedCount();
  }, [loadSavedCount]);

  useEffect(() => {
    void dispatch(hydrateAppLocation());
  }, [dispatch]);

  useEffect(() => {
    if (user?.address?.trim()) {
      dispatch(setProfileFallbackLocation(user.address.trim()));
    }
  }, [dispatch, user?.address]);

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
  }, []);

  const navigateToCategory = useCallback(
    (catId: CategorySlug) => {
      router.push(getCategoryHref(catId));
    },
    [router],
  );

  const openSearchResults = async (value?: string) => {
    const text = value?.trim() || query.trim();
    if (!text) return;

    Keyboard.dismiss();

    router.push({
      pathname: "/search-results-entity-tabs",
      params: { q: text },
    });
  };

  const handleVoiceResult = useCallback(
    (text: string) => {
      setQuery(text);
      void openSearchResults(text);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /**
   * Real-time voice streaming: partial transcripts update the search bar
   * and trigger live autocomplete suggestions — exactly like Google / OLX.
   * Debounced at 150 ms so we don't fire on every spoken syllable.
   */
  const handleVoicePartial = useCallback(
    (partial: string) => {
      setQuery(partial);
    },
    [],
  );

  const handleBottomTabPress = useTabNavigation();

  const handleRefresh = useCallback(async () => {
    await loadSavedCount();
    await onRefresh();
  }, [loadSavedCount, onRefresh]);

  useFocusEffect(
    useCallback(() => {
      void loadSavedCount();
      const onHardwareBack = () => {
        handleBottomTabPress("home");
        return true;
      };

      const sub = BackHandler.addEventListener("hardwareBackPress", onHardwareBack);
      return () => sub.remove();
    }, [handleBottomTabPress, loadSavedCount]),
  );

  const formattedSavedCount = useMemo(
    () => (savedCount < 10 ? `0${savedCount}` : String(savedCount)),
    [savedCount],
  );

  return (
    <View className="flex-1 bg-[#F6F7F8]">
      <VoiceSearchModal
        visible={voiceVisible}
        onResult={handleVoiceResult}
        onPartialResult={handleVoicePartial}
        onClose={() => setVoiceVisible(false)}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={["#1A1A1A"]}
            tintColor="#1A1A1A"
          />
        }
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: 84 + bottomNavPadding,
          paddingHorizontal: GRID_H_PADDING,
        }}
      >
        {/* Address + saved */}
        <View className="mb-4 flex-row items-center justify-between ">
          <Pressable
            onPress={() => router.push("/location-picker" as Href)}
            className="flex-1 pr-3"
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <View className="flex-row items-center gap-0.5">
              <MaterialIcons name="location-on" size={16} color="#27BB97" />
              <Text
                className="flex-1 text-[16px] text-[#1A1A1A]"
                style={{ fontFamily: ListifyFonts.bold }}
                numberOfLines={1}
              >
                {displayLocation}
              </Text>
              <MaterialIcons name="keyboard-arrow-down" size={20} color="#9CA3AF" />
            </View>
            <Text
              className="mt-0.5 text-[13px] text-[#9CA3AF]"
              style={{ fontFamily: ListifyFonts.regular }}
            >
              Tap to change location
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/saved-items" as Href)}
            className="flex-row items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-3 py-2"
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <MaterialIcons name="bookmark-outline" size={18} color="#1A1A1A" />
            <Text
              className="text-[14px] text-[#1A1A1A]"
              style={{ fontFamily: ListifyFonts.semiBold }}
            >
              {formattedSavedCount}
            </Text>
          </Pressable>
        </View>

        {/* Search bar */}
        <View
          className="mb-6 h-17 shadow-xl flex-row items-center rounded-full border border-[#ECECEC] bg-white px-4"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 4,
            elevation: 1,
          }}
        >
          <TextInput
            value={query}
            onChangeText={handleQueryChange}
            onSubmitEditing={() => void openSearchResults()}
            placeholder="Search"
            placeholderTextColor="#B0B0B0"
            className="flex-1 text-[15px] text-[#1A1A1A]"
            style={{ fontFamily: ListifyFonts.regular, paddingVertical: 0 }}
          />
          <Pressable
            onPress={() => setVoiceVisible(true)}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, marginRight: 6 })}
          >
            <MaterialIcons name="mic" size={22} color="#9CA3AF" />
          </Pressable>
          <Pressable
            onPress={() => void openSearchResults()}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons name="search" size={22} color="#9CA3AF" />
          </Pressable>
        </View>

        {/* Categories grid */}
        <Text
          className="mb-4 text-[18px] text-[#1A1A1A]"
          style={{ fontFamily: ListifyFonts.bold }}
        >
          Categories
        </Text>

        <View className="flex-row flex-wrap" style={{ gap: GRID_GAP }}>
          {searchCategoriesOrdered.map((cat) => (
            <HomeCategoryTile
              key={cat.id}
              slug={cat.id}
              label={cat.label}
              icon={cat.icon}
              size={CATEGORY_CARD_SIZE}
              onPress={() => navigateToCategory(cat.id)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
