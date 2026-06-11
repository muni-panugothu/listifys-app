import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "@/lib/safe-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ListingItemsGridCard } from "@/components/listing-items-grid-card";
import { ServiceGridCard } from "@/components/service-grid-card";
import { VoiceSearchModal } from "@/components/voice-search-modal";
import { getListingDistanceLabel } from "@/lib/listing-distance";
import { CATEGORIES } from "@/constants/categories";
import { ListifyFonts, ListifyTypography } from "@/constants/typography";
import {
  fetchServiceListings,
  toggleSaveListing,
  type ListingItem,
} from "@/features/listing/services/listing-api";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useLocale } from "@/providers/locale-provider";
import { useAppSelector } from "@/store/hooks";
import {
  selectIsoCountryCode,
  selectLocationCoords,
  selectLocationLabel,
  selectLocationSource,
} from "@/store/slices/location-slice";
import { FloatingBottomNav } from "@/components/floating-bottom-nav";
import { useTabNavigation } from "@/lib/use-tab-navigation";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BRAND = "#27BB97";
const BG = "#F6F7F8";
const GRID_GUTTER = 14;
const GRID_SIDE_PADDING = 16;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_SIDE_PADDING * 2 - GRID_GUTTER) / 2;

const SERVICE_FILTERS = [
  { key: "top_rated",  label: "Top Rated",       icon: "star"         as const },
  { key: "available", label: "Available Now",   icon: "bolt"         as const },
  { key: "budget",    label: "Budget Friendly", icon: "savings"      as const },
  { key: "latest",    label: "Latest",          icon: "schedule"     as const },
] as const;

const SERVICE_SUBCATEGORIES = [
  "All",
  ...( CATEGORIES.find((c) => c.slug === "services")?.subcategories ?? []),
];

export function ServicesCategoryHubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isoCountryCode: localeCountryCode } = useLocale();
  const user = useAppSelector((s) => s.auth.user);
  const userCoords = useAppSelector(selectLocationCoords);
  const locationLabel = useAppSelector(selectLocationLabel);
  const rawCountryCode = useAppSelector(selectIsoCountryCode);
  const locationSource = useAppSelector(selectLocationSource);
  const hasLocationCoords =
    userCoords.lat != null &&
    userCoords.lng != null;
  const isoCountryCode = (rawCountryCode ?? localeCountryCode ?? null)?.toUpperCase() ?? null;
  const shouldApplyLocationFilter = hasLocationCoords || isoCountryCode === "US";
  const canShowDistanceOnCards = useAppSelector(selectCanShowDistanceOnCards);
  const handleBottomTabPress = useTabNavigation();

  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selectedSubcategory, setSelectedSubcategory] = useState("All");
  const [activeFilter, setActiveFilter] = useState<string>("top_rated");
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [voiceVisible, setVoiceVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const headerHeight = insets.top + 12 + 52;
  const categoryTabsHeight = 52;
  const stickyOffset = headerHeight + categoryTabsHeight;

  const cityName = useMemo(() => {
    if (!locationLabel || locationLabel === "Set location" || locationLabel.startsWith("Detecting")) return null;
    return locationLabel.split(",")[0].trim() || null;
  }, [locationLabel]);

  const loadListings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // Map UI filter keys → server sort values
      const sortMap: Record<string, string> = {
        top_rated:  "-pricing.basePrice", // no rating index on server; server-side: latest by default, client re-sorts by rating
        available:  "serviceAvailability",
        budget:     "pricing.basePrice",
        latest:     "-createdAt",
      };
      const res = await fetchServiceListings({
        subcategory: selectedSubcategory === "All" ? undefined : selectedSubcategory,
        search: appliedSearch.trim() || undefined,
        lat: hasLocationCoords ? userCoords.lat! : undefined,
        lng: hasLocationCoords ? userCoords.lng! : undefined,
        radius: hasLocationCoords ? 100 : undefined,
        countryCode: shouldApplyLocationFilter ? isoCountryCode : undefined,
        sort: sortMap[activeFilter] ?? "-createdAt",
      });
      const items = res.listings ?? [];
      setListings(items);
      if (user?.id) {
        const saved = new Set<string>();
        for (const item of items) {
          if (item.savedBy?.includes(user.id)) saved.add(item._id);
        }
        setSavedIds(saved);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load services";
      setLoadError(msg);
      setListings((prev) => (prev.length > 0 ? prev : []));
    } finally {
      setLoading(false);
    }
  }, [
    activeFilter,
    appliedSearch,
    hasLocationCoords,
    isoCountryCode,
    selectedSubcategory,
    user?.id,
    userCoords.lat,
    userCoords.lng,
  ]);

  useEffect(() => {
    void loadListings();
  }, [loadListings]);

  const isMounted = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (isMounted.current) {
        void loadListings();
      } else {
        isMounted.current = true;
      }
    }, [loadListings]),
  );

  const { refreshing, onRefresh } = usePullToRefresh(loadListings);

  const displayListings = useMemo(() => {
    let items = [...listings];

    // Client-side re-sort as a secondary sort (server already sorted, this refines it)
    if (activeFilter === "top_rated") {
      // Sort by stats.rating desc (populated from aggregation if available)
      items.sort(
        (a, b) =>
          Number((b as any).stats?.rating ?? (b as any).rating ?? 0) -
          Number((a as any).stats?.rating ?? (a as any).rating ?? 0),
      );
    } else if (activeFilter === "available") {
      // Put listings with serviceAvailability text first
      items.sort((a, b) => {
        const aHas = !!(a as any).serviceAvailability;
        const bHas = !!(b as any).serviceAvailability;
        if (aHas === bHas) return 0;
        return aHas ? -1 : 1;
      });
    } else if (activeFilter === "budget") {
      items.sort(
        (a, b) =>
          Number((a as any).pricing?.basePrice ?? a.price ?? 1e12) -
          Number((b as any).pricing?.basePrice ?? b.price ?? 1e12),
      );
    } else if (activeFilter === "latest") {
      items.sort((a, b) => {
        const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bt - at;
      });
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      items = items.filter(
        (item) =>
          item.title?.toLowerCase().includes(q) ||
          item.location?.toLowerCase().includes(q) ||
          item.subcategory?.toLowerCase().includes(q),
      );
    }
    return items;
  }, [activeFilter, listings, searchQuery]);

  const handleToggleSave = useCallback(async (id: string) => {
    try {
      const res = await toggleSaveListing("services", id);
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (res.saved) next.add(id);
        else next.delete(id);
        return next;
      });
    } catch {
      // ignore
    }
  }, []);

  const listingRows = useMemo(() => {
    const rows: ListingItem[][] = [];
    for (let i = 0; i < displayListings.length; i += 2) {
      rows.push(displayListings.slice(i, i + 2));
    }
    return rows;
  }, [displayListings]);

  const handleVoiceResult = useCallback((text: string) => {
    setSearchQuery(text);
    setAppliedSearch(text);
  }, []);

  return (
    <View className="flex-1" style={{ backgroundColor: BG }}>
      <VoiceSearchModal
        visible={voiceVisible}
        onResult={handleVoiceResult}
        onClose={() => setVoiceVisible(false)}
      />
      {/* ── Top bar: back arrow + search ── */}
      <View
        className="absolute inset-x-0 top-0 z-50 px-4"
        style={{ paddingTop: insets.top + 8, height: headerHeight, backgroundColor: BG }}
      >
        <View className="h-11 flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            className="h-10 w-10 items-center justify-center"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons name="arrow-back-ios" size={20} color="#1A1A1A" />
          </Pressable>
          <View
            className="h-17 flex-1 flex-row items-center rounded-full border border-[#E8E8E8] bg-white px-4"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 6,
              elevation: 1,
            }}
          >
            <MaterialIcons name="search" size={22} color="#B8B8B8" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => setAppliedSearch(searchQuery.trim())}
              returnKeyType="search"
              placeholder="Search services…"
              placeholderTextColor="#B0B0B0"
              className="ml-3 flex-1 text-[15px] text-[#1A1A1A]"
              style={{ fontFamily: ListifyFonts.regular, paddingVertical: 0 }}
            />
            {searchQuery.length > 0 ? (
              <Pressable
                onPress={() => { setSearchQuery(""); setAppliedSearch(""); }}
                hitSlop={8}
              >
                <MaterialIcons name="close" size={20} color="#9CA3AF" />
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setVoiceVisible(true)}
                hitSlop={8}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <MaterialIcons name="mic" size={20} color="#9CA3AF" />
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* ── Subcategory chips (bold, Vehicles style) ── */}
      <View
        className="absolute inset-x-0 z-40 bg-[#F6F7F8]"
        style={{ top: headerHeight, height: categoryTabsHeight }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: GRID_SIDE_PADDING,
            paddingVertical: 10,
            gap: 20,
            alignItems: "center",
          }}
        >
          {SERVICE_SUBCATEGORIES.map((chip) => {
            const isActive = selectedSubcategory === chip;
            return (
              <Pressable
                key={chip}
                onPress={() => setSelectedSubcategory(chip)}
                style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
              >
                <Text
                  className="text-[22px] tracking-tight"
                  style={{
                    fontFamily: ListifyFonts.bold,
                    color: isActive ? "#1A1A1A" : "#C8CDD2",
                  }}
                >
                  {chip}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Listings ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[BRAND]}
            tintColor={BRAND}
            progressViewOffset={stickyOffset}
          />
        }
        contentContainerStyle={{
          paddingTop: stickyOffset + 8,
          paddingBottom: Math.max(insets.bottom, 16) + 24,
        }}
      >
        {/* Professional filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-5"
          contentContainerStyle={{ paddingHorizontal: GRID_SIDE_PADDING, paddingVertical: 4, gap: 10 }}
        >
          {SERVICE_FILTERS.map((f) => {
            const isActive = f.key === activeFilter;
            return (
              <Pressable
                key={f.key}
                onPress={() => setActiveFilter(f.key)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderRadius: 24,
                  backgroundColor: isActive ? BRAND : "#FFFFFF",
                  borderWidth: 1,
                  borderColor: isActive ? BRAND : "#E5E7EB",
                  opacity: pressed ? 0.82 : 1,
                  shadowColor: isActive ? BRAND : "#000",
                  shadowOffset: { width: 0, height: isActive ? 4 : 1 },
                  shadowOpacity: isActive ? 0.28 : 0.07,
                  shadowRadius: isActive ? 10 : 3,
                  elevation: isActive ? 5 : 1,
                })}
              >
                <MaterialIcons
                  name={f.icon}
                  size={14}
                  color={isActive ? "#FFFFFF" : "#6B7280"}
                />
                <Text
                  style={{
                    fontFamily: ListifyFonts.semiBold,
                    fontSize: 13,
                    color: isActive ? "#FFFFFF" : "#374151",
                  }}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {(loading || refreshing) && displayListings.length === 0 ? (
          <View className="items-center py-20">
            <ActivityIndicator size="large" color={BRAND} />
            <Text className="mt-3 text-[14px]" style={ListifyTypography.label}>
              Loading…
            </Text>
          </View>
        ) : loadError ? (
          <View className="items-center px-6 py-20">
            <MaterialIcons name="wifi-off" size={56} color="#D1D5DB" />
            <Text className="mt-4 text-[18px]" style={ListifyTypography.sectionTitle}>
              Could not load services
            </Text>
            <Text className="mt-2 text-center text-[13px]" style={ListifyTypography.body}>
              {loadError}
            </Text>
            <Pressable
              onPress={() => void loadListings()}
              className="mt-5 rounded-full bg-[#27BB97] px-6 py-3"
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            >
              <Text className="text-[14px] font-semibold text-white">Retry</Text>
            </Pressable>
          </View>
        ) : displayListings.length === 0 ? (
          <View className="items-center px-6 py-20">
            <MaterialIcons name="home-repair-service" size={56} color="#D1D5DB" />
            <Text className="mt-4 text-[18px]" style={ListifyTypography.sectionTitle}>
              {cityName ? `No services found in ${cityName}` : "No services found"}
            </Text>
            <Text className="mt-2 text-center text-[14px]" style={ListifyTypography.body}>
              Try another filter or search term
            </Text>
          </View>
        ) : (
          <View className="px-4" style={{ gap: GRID_GUTTER }}>
            {listingRows.map((row) => (
              <View key={row.map((i) => i._id).join("-")} className="flex-row" style={{ gap: GRID_GUTTER }}>
                {row.map((item) => {
                  const pricing = (item as any).pricing;
                  const priceVal = pricing?.basePrice ?? item.price ?? null;
                  const priceType = pricing?.priceType ?? (item as any).priceType ?? undefined;

                  return (
                    <ServiceGridCard
                      key={item._id}
                      title={item.title}
                      subcategory={item.subcategory}
                      price={priceVal}
                      priceType={priceType}
                      currency={item.currency}
                      isoCountryCode={item.countryCode ?? isoCountryCode}
                      image={item.images?.[0]}
                      rating={(item as any).stats?.rating ?? null}
                      reviewCount={(item as any).stats?.reviewCount ?? null}
                      distanceLabel={canShowDistanceOnCards ? getListingDistanceLabel(
                        {
                          _id: item._id,
                          category: item.category,
                          distance: item.distance,
                          coordinates: item.coordinates,
                          countryCode: item.countryCode,
                          currency: item.currency,
                        },
                        hasLocationCoords
                          ? { lat: userCoords.lat!, lng: userCoords.lng! }
                          : null,
                        isoCountryCode,
                      ) : undefined}
                      width={CARD_WIDTH}
                      isSaved={savedIds.has(item._id)}
                      onPress={() =>
                        router.push(`/service-detail?category=services&id=${item._id}` as any)
                      }
                      onToggleSave={() => handleToggleSave(item._id)}
                    />
                  );
                })}
                {row.length === 1 ? <View style={{ width: CARD_WIDTH }} /> : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <FloatingBottomNav activeTabId="search" onTabPress={handleBottomTabPress} />
    </View>
  );
}
