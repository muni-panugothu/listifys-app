import { MaterialIcons } from "@expo/vector-icons";
import { type Href, useRouter } from "@/lib/safe-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { CATEGORY_MAP, type CategorySlug } from "@/constants/categories";
import { ListifyFonts, ListifyTypography } from "@/constants/typography";
import { EventListingCard } from "@/features/category/components/event-listing-card";
import { JobListingCard } from "@/features/category/components/job-listing-card";
import {
  fetchCategoryListings,
  toggleSaveListing,
  type ListingItem,
} from "@/features/listing/services/listing-api";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { getListingDistanceLabel } from "@/lib/listing-distance";
import { useAppSelector } from "@/store/hooks";
import { selectLocationCoords } from "@/store/slices/location-slice";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BG = "#F6F7F8";
const BRAND = "#27BB97";
const GRID_GUTTER = 14;
const GRID_SIDE_PADDING = 16;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_SIDE_PADDING * 2 - GRID_GUTTER) / 2;

const SORT_OPTIONS = [
  { key: "relevance", label: "Relevant" },
  { key: "price_asc", label: "Low to High" },
  { key: "price_desc", label: "High to Low" },
  { key: "newest", label: "Newest" },
] as const;

const SPECIAL_DETAIL: Record<string, string> = {
  events: "/event-detail",
  properties: "/property-detail",
  jobs: "/job-detail",
};

const FETCH_TIMEOUT_MS = 8_000;

function formatSalary(listing: ListingItem): string {
  const salary = (listing as { salary?: { min?: number; max?: number } }).salary;
  const currency = listing.currency ?? "₹";
  if (salary?.min && salary?.max) {
    const fmt = (n: number) => {
      if (n >= 100000) return `${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L`;
      if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
      return n.toLocaleString("en-IN");
    };
    return `${currency}${fmt(salary.min)} - ${currency}${fmt(salary.max)}`;
  }
  if (listing.price) return `${currency}${Number(listing.price).toLocaleString("en-IN")}`;
  return "Salary not disclosed";
}

function formatEventPrice(price?: number, currency?: string): string {
  if (!price || price === 0) return "FREE";
  return `${currency ?? "₹"}${Number(price).toLocaleString("en-IN")}`;
}

function sortListings(items: ListingItem[], sortKey: string) {
  const copy = [...items];
  if (sortKey === "price_asc") {
    copy.sort((a, b) => Number(a.price ?? 1e12) - Number(b.price ?? 1e12));
  } else if (sortKey === "price_desc") {
    copy.sort((a, b) => Number(b.price ?? 0) - Number(a.price ?? 0));
  } else if (sortKey === "newest") {
    copy.sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bt - at;
    });
  }
  return copy;
}

type CategoryBrowseScreenProps = {
  categorySlug: CategorySlug;
};

export function CategoryBrowseScreen({ categorySlug }: CategoryBrowseScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAppSelector((s) => s.auth.user);
  const userCoords = useAppSelector(selectLocationCoords);

  const categoryConfig = CATEGORY_MAP[categorySlug];
  const subcategories = useMemo(
    () => ["All", ...(categoryConfig?.subcategories ?? [])],
    [categoryConfig?.subcategories],
  );

  const layout = categorySlug === "jobs" ? "jobs" : categorySlug === "events" ? "events" : "grid";

  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selectedSubcategory, setSelectedSubcategory] = useState("All");
  const [activeSort, setActiveSort] = useState<string>("relevance");
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const headerHeight = insets.top + 12 + 52;
  const categoryTabsHeight = 52;
  const stickyOffset = headerHeight + categoryTabsHeight;

  const loadListings = useCallback(async () => {
    try {
      const res = await Promise.race([
        fetchCategoryListings(categorySlug, {
          subcategory: selectedSubcategory === "All" ? undefined : selectedSubcategory,
          search: appliedSearch.trim() || undefined,
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("timeout")), FETCH_TIMEOUT_MS);
        }),
      ]);
      const items = res.listings ?? [];
      setListings(items);
      if (user?.id) {
        const saved = new Set<string>();
        for (const item of items) {
          if (item.savedBy?.includes(user.id)) saved.add(item._id);
        }
        setSavedIds(saved);
      }
    } catch {
      setListings((prev) => (prev.length > 0 ? prev : []));
    }
  }, [appliedSearch, categorySlug, selectedSubcategory, user?.id]);

  useEffect(() => {
    void loadListings();
  }, [loadListings]);

  const handleRefresh = useCallback(async () => {
    await loadListings();
  }, [loadListings]);

  const { refreshing, onRefresh } = usePullToRefresh(handleRefresh);

  const displayListings = useMemo(() => {
    let items = sortListings(listings, activeSort);
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
  }, [activeSort, listings, searchQuery]);

  const openDetail = useCallback(
    (item: ListingItem) => {
      const special = SPECIAL_DETAIL[categorySlug];
      if (special) {
        router.push({
          pathname: special as Href,
          params: { category: categorySlug, id: item._id },
        });
        return;
      }
      router.push(
        `/listing-detail-template?category=${categorySlug}&id=${item._id}` as Href,
      );
    },
    [categorySlug, router],
  );

  const handleToggleSave = useCallback(
    async (id: string) => {
      try {
        const res = await toggleSaveListing(categorySlug, id);
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (res.saved) next.add(id);
          else next.delete(id);
          return next;
        });
      } catch {
        // ignore
      }
    },
    [categorySlug],
  );

  const handleSubmitSearch = useCallback(() => {
    setAppliedSearch(searchQuery.trim());
  }, [searchQuery]);

  const listingRows = useMemo(() => {
    const rows: ListingItem[][] = [];
    for (let i = 0; i < displayListings.length; i += 2) {
      rows.push(displayListings.slice(i, i + 2));
    }
    return rows;
  }, [displayListings]);

  return (
    <View className="flex-1" style={{ backgroundColor: BG }}>
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
              onSubmitEditing={handleSubmitSearch}
              returnKeyType="search"
              placeholder="Search here"
              placeholderTextColor="#B0B0B0"
              className="ml-3 flex-1 text-[15px] text-[#1A1A1A]"
              style={{ fontFamily: ListifyFonts.regular, paddingVertical: 0 }}
            />
            {searchQuery.length > 0 ? (
              <Pressable
                onPress={() => {
                  setSearchQuery("");
                  setAppliedSearch("");
                }}
                hitSlop={8}
              >
                <MaterialIcons name="close" size={20} color="#9CA3AF" />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

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
          {subcategories.map((chip) => {
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-4"
          contentContainerStyle={{ paddingHorizontal: GRID_SIDE_PADDING, gap: 8 }}
        >
          {SORT_OPTIONS.map((opt) => {
            const isActive = opt.key === activeSort;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setActiveSort(opt.key)}
                className="rounded-full px-3.5 py-2"
                style={{
                  backgroundColor: isActive ? "rgba(39,187,151,0.12)" : "#FFFFFF",
                  borderWidth: 1,
                  borderColor: isActive ? "rgba(39,187,151,0.35)" : "#E5E7EB",
                }}
              >
                <Text
                  className="text-[12px]"
                  style={{
                    fontFamily: ListifyFonts.medium,
                    color: isActive ? BRAND : "#4B5563",
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {refreshing && displayListings.length === 0 ? (
          <View className="items-center py-20">
            <ActivityIndicator size="large" color={BRAND} />
            <Text className="mt-3 text-[14px]" style={ListifyTypography.label}>
              Loading listings…
            </Text>
          </View>
        ) : displayListings.length === 0 ? (
          <View className="items-center px-6 py-20">
            <MaterialIcons name="inventory-2" size={56} color="#D1D5DB" />
            <Text className="mt-4 text-[18px]" style={ListifyTypography.sectionTitle}>
              No listings found
            </Text>
            <Text className="mt-2 text-center text-[14px]" style={ListifyTypography.body}>
              Try another filter or search term
            </Text>
          </View>
        ) : layout === "jobs" ? (
          <View className="gap-3 px-4">
            {displayListings.map((job) => (
              <JobListingCard
                key={job._id}
                job={job}
                salaryText={formatSalary(job)}
                isSaved={savedIds.has(job._id)}
                onPress={() => openDetail(job)}
                onToggleSave={() => handleToggleSave(job._id)}
              />
            ))}
          </View>
        ) : layout === "events" ? (
          <View className="gap-3 px-4">
            {displayListings.map((event) => (
              <EventListingCard
                key={event._id}
                event={event}
                priceLabel={formatEventPrice(event.price, event.currency)}
                isSaved={savedIds.has(event._id)}
                onPress={() => openDetail(event)}
                onToggleSave={() => handleToggleSave(event._id)}
              />
            ))}
          </View>
        ) : (
          <View className="px-4" style={{ gap: GRID_GUTTER }}>
            {listingRows.map((row) => (
              <View key={row.map((i) => i._id).join("-")} className="flex-row" style={{ gap: GRID_GUTTER }}>
                {row.map((item) => (
                  <ListingItemsGridCard
                    key={item._id}
                    title={item.title}
                    subtitle={item.condition || item.subcategory}
                    price={item.price ?? null}
                    image={item.images?.[0]}
                    createdAt={item.createdAt}
                    width={CARD_WIDTH}
                    distanceLabel={getListingDistanceLabel(
                      {
                        _id: item._id,
                        category: categorySlug,
                        distance: item.distance as number | undefined,
                        coordinates: item.coordinates,
                      },
                      userCoords.lat != null && userCoords.lng != null
                        ? { lat: userCoords.lat, lng: userCoords.lng }
                        : null,
                    )}
                    isSaved={savedIds.has(item._id)}
                    onPress={() => openDetail(item)}
                    onToggleSave={() => handleToggleSave(item._id)}
                  />
                ))}
                {row.length === 1 ? <View style={{ width: CARD_WIDTH }} /> : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
