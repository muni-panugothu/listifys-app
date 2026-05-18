import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "@/lib/safe-router";
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
import { getListingDistanceLabel } from "@/lib/listing-distance";
import { TopSaveToast } from "@/components/top-save-toast";
import { CATEGORIES } from "@/constants/categories";
import { DUMMY_TRENDING_LISTINGS } from "@/constants/dummy-trending-listings";
import { ListifyFonts, ListifyTypography } from "@/constants/typography";
import {
  fetchHomeFeed,
  fetchSavedListings,
  toggleSaveListing,
} from "@/features/listing/services/listing-api";
import {
  searchListings,
  type SearchResultItem,
  type SearchPagination,
} from "@/features/search/services/search-api";
import type { Href } from "@/lib/safe-router";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_GUTTER = 14;
const GRID_SIDE_PADDING = 16;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_SIDE_PADDING * 2 - GRID_GUTTER) / 2;

const CATEGORY_TABS = [
  { key: "all", label: "All" },
  ...CATEGORIES.map((c) => ({ key: c.slug, label: c.name })),
];

function parseEntityParam(value: string | string[] | undefined) {
  const entity = parseQueryParam(value);
  if (entity && CATEGORY_TABS.some((tab) => tab.key === entity)) {
    return entity;
  }
  return "all";
}

const SORT_OPTIONS = [
  { key: "relevance", label: "Relevant" },
  { key: "price_asc", label: "Low to High" },
  { key: "price_desc", label: "High to Low" },
  { key: "nearest", label: "Nearby" },
  { key: "oldest", label: "Oldest" },
  { key: "views", label: "Most Viewed" },
] as const;

function parseQueryParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function sortLocalResults(items: SearchResultItem[], sortKey: string) {
  const copy = [...items];

  if (sortKey === "price_asc") {
    copy.sort(
      (a, b) =>
        Number(a.price ?? Number.MAX_SAFE_INTEGER) -
        Number(b.price ?? Number.MAX_SAFE_INTEGER),
    );
    return copy;
  }

  if (sortKey === "price_desc") {
    copy.sort((a, b) => Number(b.price ?? 0) - Number(a.price ?? 0));
    return copy;
  }

  if (sortKey === "nearest") {
    copy.sort(
      (a, b) =>
        Number(a.distance ?? Number.MAX_SAFE_INTEGER) -
        Number(b.distance ?? Number.MAX_SAFE_INTEGER),
    );
    return copy;
  }

  if (sortKey === "oldest") {
    copy.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
    return copy;
  }

  if (sortKey === "views") {
    copy.sort((a, b) => Number(b.views ?? 0) - Number(a.views ?? 0));
    return copy;
  }

  return copy;
}

function mapFeedToResults(
  feedListings: Array<{
    _id: string;
    title: string;
    description?: string;
    price?: number | null;
    currency?: string;
    category?: string;
    subcategory?: string;
    condition?: string;
    location?: string;
    images?: string[];
    brand?: string;
    model?: string;
    sellerName?: string;
    seller?: unknown;
    views?: number;
    status?: string;
    createdAt?: string;
    savedBy?: string[];
  }>,
): SearchResultItem[] {
  return feedListings.map((item) => ({
    _id: item._id,
    title: item.title,
    description: item.description,
    price: item.price,
    currency: item.currency,
    category: item.category,
    subcategory: item.subcategory,
    condition: item.condition,
    location: item.location,
    images: item.images ?? [],
    brand: typeof item.brand === "string" ? item.brand : undefined,
    model: typeof item.model === "string" ? item.model : undefined,
    sellerName: item.sellerName,
    seller: item.seller,
    views: item.views,
    status: item.status,
    createdAt: item.createdAt,
    _entity: String((item as { _source?: string })._source ?? item.category ?? "others"),
  }));
}

const FEED_FETCH_TIMEOUT_MS = 10_000;

function buildDummySearchResults(): SearchResultItem[] {
  return DUMMY_TRENDING_LISTINGS.map((d) => ({
    _id: d.id,
    title: d.title,
    price: d.price,
    images: [d.image],
    category: d.category,
    _entity: d.category,
    condition: "Featured",
  }));
}

/** Always merge dummy trending listings (deduped) for browse / trending views. */
function mergeDummyResults(items: SearchResultItem[]): SearchResultItem[] {
  const dummyMapped = buildDummySearchResults();
  const existingIds = new Set(items.map((i) => i._id));
  const merged = [...items];
  for (const d of dummyMapped) {
    if (!existingIds.has(d._id)) merged.push(d);
  }
  return merged;
}

function applyEntityAndSort(
  items: SearchResultItem[],
  entity: string,
  sortKey: string,
): SearchResultItem[] {
  const merged = mergeDummyResults(items);
  const filtered =
    entity === "all" ? merged : merged.filter((item) => item._entity === entity);
  const sorted = sortLocalResults(filtered, sortKey);
  if (sorted.length > 0) return sorted;
  return sortLocalResults(buildDummySearchResults(), sortKey);
}

async function fetchHomeFeedWithTimeout(limit: number) {
  return Promise.race([
    fetchHomeFeed({ limit }),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("feed_timeout")), FEED_FETCH_TIMEOUT_MS);
    }),
  ]);
}

export function SearchResultsEntityTabsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    q?: string | string[];
    entity?: string | string[];
    title?: string | string[];
    hideTabs?: string | string[];
  }>();
  const insets = useSafeAreaInsets();
  const initialEntity = useMemo(
    () => parseEntityParam(params.entity),
    [params.entity],
  );
  /** When opening a single category (e.g. Electronics), hide All/Jobs/Vehicles tabs. */
  const lockedEntity = useMemo(() => {
    const raw = parseQueryParam(params.entity);
    return raw && raw !== "all" ? raw : null;
  }, [params.entity]);
  const hideEntityTabs =
    parseQueryParam(params.hideTabs) === "1" ||
    parseQueryParam(params.hideTabs) === "true";
  const showEntityTabs = !lockedEntity && !hideEntityTabs;
  const [activeEntity, setActiveEntity] = useState(initialEntity);
  const [activeSort, setActiveSort] = useState<string>("relevance");
  const [searchQuery, setSearchQuery] = useState(() => parseQueryParam(params.q));
  const [appliedQuery, setAppliedQuery] = useState(() => parseQueryParam(params.q));
  const [results, setResults] = useState<SearchResultItem[]>(() =>
    applyEntityAndSort(mergeDummyResults([]), "all", "relevance"),
  );
  const [pagination, setPagination] = useState<SearchPagination | null>(() => ({
    total: DUMMY_TRENDING_LISTINGS.length,
    page: 1,
    pages: 1,
    limit: 50,
  }));
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [saveToastVisible, setSaveToastVisible] = useState(false);
  const [saveToastKey, setSaveToastKey] = useState(0);

  const headerHeight = insets.top + 12 + 52;
  const categoryTabsHeight = 52;
  const stickyTopOffset =
    headerHeight + (showEntityTabs ? categoryTabsHeight : 0);

  const loadSaved = useCallback(async () => {
    try {
      const res = await fetchSavedListings();
      setSavedIds(new Set((res.listings ?? []).map((l) => l._id)));
    } catch {
      // ignore
    }
  }, []);

  const doSearch = useCallback(
    async (opts?: { isRefresh?: boolean }) => {
      const q = appliedQuery.trim();
      const isBrowse = !q;

      if (opts?.isRefresh) {
        setRefreshing(true);
      } else if (!isBrowse) {
        setLoading(true);
      }

      if (isBrowse) {
        setResults((prev) =>
          prev.length > 0
            ? applyEntityAndSort(mergeDummyResults(prev), activeEntity, activeSort)
            : applyEntityAndSort(mergeDummyResults([]), activeEntity, activeSort),
        );
      }

      try {
        if (isBrowse) {
          let mapped: SearchResultItem[] = [];

          try {
            const feed = await fetchHomeFeedWithTimeout(60);
            const feedListings = feed?.categories
              ? Object.values(feed.categories).flatMap((cat) => cat.listings ?? [])
              : [];
            mapped = mapFeedToResults(feedListings);
          } catch {
            mapped = [];
          }

          mapped = mergeDummyResults(mapped);
          const sorted = applyEntityAndSort(mapped, activeEntity, activeSort);

          setResults(sorted);
          setPagination({
            total: sorted.length,
            page: 1,
            pages: 1,
            limit: 50,
          });
          return;
        }

        const res = await searchListings({
          q,
          entity: activeEntity === "all" ? undefined : activeEntity,
          sort: activeSort as
            | "relevance"
            | "price_asc"
            | "price_desc"
            | "nearest"
            | "oldest"
            | "views",
          page: 1,
          limit: 50,
        });
        let items = res.results || [];
        items = mergeDummyResults(items);
        setResults(applyEntityAndSort(items, activeEntity, activeSort));
        setPagination(res.pagination || null);
      } catch {
        const fallback = applyEntityAndSort(
          mergeDummyResults([]),
          activeEntity,
          activeSort,
        );
        setResults(fallback);
        setPagination({
          total: fallback.length,
          page: 1,
          pages: 1,
          limit: 50,
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [appliedQuery, activeEntity, activeSort],
  );

  useEffect(() => {
    void loadSaved();
  }, [loadSaved]);

  useEffect(() => {
    if (lockedEntity) {
      setActiveEntity(lockedEntity);
      return;
    }
    setActiveEntity(initialEntity);
  }, [initialEntity, lockedEntity]);

  useEffect(() => {
    doSearch();
  }, [doSearch]);

  const handleRefresh = useCallback(() => {
    void loadSaved();
    doSearch({ isRefresh: true });
  }, [doSearch, loadSaved]);

  const handleSubmitSearch = useCallback(() => {
    setAppliedQuery(searchQuery.trim());
  }, [searchQuery]);

  const openDetail = useCallback(
    (item: SearchResultItem) => {
      const cat = item._entity;
      const specialRoutes: Record<string, string> = {
        events: "/event-detail",
        properties: "/property-detail",
        jobs: "/job-detail",
        services: "/service-detail",
      };
      const specialRoute = specialRoutes[cat];
      if (specialRoute) {
        router.push({
          pathname: specialRoute as Href,
          params: { category: cat, id: item._id },
        });
      } else {
        router.push({
          pathname: "/listing-detail-template",
          params: { category: cat, id: item._id },
        });
      }
    },
    [router],
  );

  const showSaveToast = useCallback(() => {
    setSaveToastKey((k) => k + 1);
    setSaveToastVisible(true);
  }, []);

  const handleToggleSave = useCallback(
    async (item: SearchResultItem) => {
      let wasSaved = false;

      setSavedIds((prev) => {
        wasSaved = prev.has(item._id);
        const next = new Set(prev);
        if (wasSaved) next.delete(item._id);
        else next.add(item._id);
        return next;
      });

      if (!wasSaved) {
        showSaveToast();
      }

      if (item._id.startsWith("dummy-")) {
        return;
      }

      try {
        const res = await toggleSaveListing(item._entity, item._id);
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (res.saved) next.add(item._id);
          else next.delete(item._id);
          return next;
        });
      } catch {
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (wasSaved) next.add(item._id);
          else next.delete(item._id);
          return next;
        });
      }
    },
    [showSaveToast],
  );

  const displayResults = useMemo(() => {
    const liveQ = searchQuery.trim().toLowerCase();
    let list = results;

    if (liveQ && !appliedQuery.trim()) {
      list = list.filter(
        (item) =>
          item.title?.toLowerCase().includes(liveQ) ||
          item.location?.toLowerCase().includes(liveQ) ||
          item.condition?.toLowerCase().includes(liveQ),
      );
    }

    return sortLocalResults(list, activeSort);
  }, [results, searchQuery, appliedQuery, activeSort]);

  return (
    <View className="flex-1 bg-[#F6F7F8]">
      {saveToastVisible ? (
        <TopSaveToast
          key={saveToastKey}
          visible
          message="Item saved"
          onHidden={() => setSaveToastVisible(false)}
        />
      ) : null}

      {/* Header: Back + home-style search */}
      <View
        className="absolute inset-x-0 top-0 z-50 bg-[#F6F7F8] px-4"
        style={{ paddingTop: insets.top + 8, height: headerHeight }}
      >
        <View className="h-11 flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text
              className="text-[17px]"
              style={{ fontFamily: ListifyFonts.semiBold, color: "#27BB97" }}
            >
              Back
            </Text>
          </Pressable>

          <View
            className="h-11 flex-1 flex-row items-center rounded-full border border-[#E8E8E8] bg-white px-4"
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
              style={{
                fontFamily: ListifyFonts.regular,
                paddingVertical: 0,
              }}
            />
            {searchQuery.length > 0 ? (
              <Pressable
                onPress={() => {
                  setSearchQuery("");
                  setAppliedQuery("");
                }}
                hitSlop={8}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <MaterialIcons name="close" size={20} color="#9CA3AF" />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      {/* Category tabs — only for Trending / See all / search (not single-category browse) */}
      {showEntityTabs ? (
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
            {CATEGORY_TABS.map((tab) => {
              const isActive = tab.key === activeEntity;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveEntity(tab.key)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
                >
                  <Text
                    className="text-[22px] tracking-tight"
                    style={{
                      fontFamily: ListifyFonts.bold,
                      color: isActive ? "#1A1A1A" : "#C8CDD2",
                    }}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={["#27BB97"]}
            tintColor="#27BB97"
            progressViewOffset={stickyTopOffset}
          />
        }
        contentContainerStyle={{
          paddingTop: stickyTopOffset + 8,
          paddingBottom: Math.max(insets.bottom, 16) + 24,
        }}
      >
        {/* Sort & filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-4"
          contentContainerStyle={{
            paddingHorizontal: GRID_SIDE_PADDING,
            gap: 8,
          }}
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
                    color: isActive ? "#27BB97" : "#4B5563",
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}

          <Pressable
            onPress={() =>
              router.push({
                pathname: "/nearby-map-view-bottom-sheet",
                params: { q: searchQuery },
              } as Href)
            }
            className="flex-row items-center gap-1 rounded-full border border-[#27BB97]/25 bg-white px-3.5 py-2"
          >
            <MaterialIcons name="map" size={15} color="#27BB97" />
            <Text
              className="text-[12px]"
              style={{ fontFamily: ListifyFonts.medium, color: "#27BB97" }}
            >
              Map
            </Text>
          </Pressable>
        </ScrollView>

        {loading && displayResults.length === 0 ? (
          <View className="items-center py-20">
            <ActivityIndicator size="large" color="#27BB97" />
            <Text className="mt-3 text-[14px]" style={ListifyTypography.label}>
              Loading listings…
            </Text>
          </View>
        ) : null}

        {refreshing && displayResults.length > 0 ? (
          <View className="mb-3 items-center">
            <ActivityIndicator size="small" color="#27BB97" />
          </View>
        ) : null}

        {!loading && displayResults.length === 0 ? (
          <View className="items-center px-6 py-20">
            <MaterialIcons name="inventory-2" size={56} color="#D1D5DB" />
            <Text
              className="mt-4 text-center text-[18px]"
              style={ListifyTypography.sectionTitle}
            >
              No listings found
            </Text>
            <Text className="mt-2 text-center text-[14px]" style={ListifyTypography.body}>
              Try another category or adjust your filters
            </Text>
          </View>
        ) : null}

        {displayResults.length > 0 ? (
          <View
            className="flex-row flex-wrap px-4"
            style={{ columnGap: GRID_GUTTER, rowGap: GRID_GUTTER }}
          >
            {displayResults.map((item) => {
              const distanceLabel = getListingDistanceLabel({
                _id: item._id,
                category: item._entity ?? item.category,
                distance: item.distance,
              });
              const metaSubtitle = [
                item.condition,
                item.subcategory,
                !distanceLabel ? item.location : null,
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <ListingItemsGridCard
                  key={`${item._entity}_${item._id}`}
                  width={CARD_WIDTH}
                  title={item.title}
                  subtitle={metaSubtitle || undefined}
                  price={item.price}
                  image={item.images?.[0]}
                  createdAt={item.createdAt}
                  distanceLabel={distanceLabel}
                  isSaved={savedIds.has(item._id)}
                  onPress={() => openDetail(item)}
                  onToggleSave={() => handleToggleSave(item)}
                />
              );
            })}
          </View>
        ) : null}

        {pagination && displayResults.length > 0 ? (
          <Text
            className="mt-6 text-center text-[12px]"
            style={ListifyTypography.label}
          >
            {displayResults.length} listing{displayResults.length === 1 ? "" : "s"}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
