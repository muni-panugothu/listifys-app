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

import {
  searchListings,
  type SearchResultItem,
  type SearchPagination,
} from "@/features/search/services/search-api";
import { Image } from "@/lib/nativewind-interop";
import { useTabNavigation } from "@/lib/use-tab-navigation";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_GUTTER = 12;
const GRID_SIDE_PADDING = 20;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_SIDE_PADDING * 2 - GRID_GUTTER) / 2;

const ENTITY_TABS = [
  { key: "all", label: "All" },
  { key: "electronics", label: "Electronics" },
  { key: "mobiles", label: "Mobiles" },
  { key: "vehicles", label: "Vehicles" },
  { key: "properties", label: "Properties" },
  { key: "fashion", label: "Fashion" },
  { key: "furniture", label: "Furniture" },
  { key: "jobs", label: "Jobs" },
  { key: "services", label: "Services" },
  { key: "events", label: "Events" },
  { key: "sports", label: "Sports" },
  { key: "pets", label: "Pets" },
  { key: "books", label: "Books" },
  { key: "beauty", label: "Beauty" },
  { key: "toys", label: "Toys" },
  { key: "forsale", label: "For Sale" },
  { key: "collectibles", label: "Collectibles" },
  { key: "others", label: "Others" },
];

const SORT_OPTIONS = [
  { key: "relevance", label: "Relevant" },
  { key: "price_asc", label: "Price: Low" },
  { key: "price_desc", label: "Price: High" },
  { key: "nearest", label: "Nearest" },
  { key: "oldest", label: "Oldest" },
  { key: "views", label: "Most Viewed" },
] as const;

const bottomTabs = [
  { id: "home", label: "Home", icon: "home" as const },
  { id: "search", label: "Search", icon: "search" as const, active: true },
  { id: "sell", label: "Sell", icon: "add-circle" as const, highlight: true },
  { id: "messages", label: "Messages", icon: "chat-bubble" as const },
  { id: "profile", label: "Profile", icon: "person" as const },
];

function parseQueryParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function SearchResultsEntityTabsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const [activeEntity, setActiveEntity] = useState("all");
  const [activeSort, setActiveSort] = useState<string>("relevance");
  const [searchQuery, setSearchQuery] = useState(() =>
    parseQueryParam(params.q),
  );
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [pagination, setPagination] = useState<SearchPagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [source, setSource] = useState<string>("");

  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const bottomNavPadding = Math.max(insets.bottom, 8);
  const handleBottomTabPress = useTabNavigation();

  const doSearch = useCallback(
    async (opts?: { page?: number; isRefresh?: boolean }) => {
      const q = searchQuery.trim();
      if (!q) return;

      if (opts?.isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const res = await searchListings({
          q,
          entity: activeEntity === "all" ? undefined : activeEntity,
          sort: activeSort as any,
          page: opts?.page ?? 1,
          limit: 50,
        });
        setResults(res.results || []);
        setPagination(res.pagination || null);
        setSource(res.source || "");
      } catch {
        // keep existing results on error
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [searchQuery, activeEntity, activeSort],
  );

  useEffect(() => {
    doSearch();
  }, [doSearch]);

  const handleRefresh = useCallback(() => {
    doSearch({ isRefresh: true });
  }, [doSearch]);

  const handleSubmit = () => {
    doSearch();
  };

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      <View
        className="absolute inset-x-0 top-0 z-50 border-b border-slate-100 bg-white/90 px-4"
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
        <View className="h-16 flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons name="arrow-back" size={23} color="#27BB97" />
          </Pressable>

          <View className="relative flex-1">
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSubmit}
              returnKeyType="search"
              className="h-10 rounded-full bg-[#EFF5F0] pl-10 pr-4 text-[14px] text-[#161D1A]"
              style={{ paddingVertical: 0 }}
            />
            <View className="absolute left-3 top-0 h-10 items-center justify-center">
              <MaterialIcons name="search" size={16} color="#6C7A74" />
            </View>
          </View>

          <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <MaterialIcons name="tune" size={21} color="#64748B" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={["#27BB97"]}
            tintColor="#27BB97"
            progressViewOffset={topBarHeight}
          />
        }
        contentContainerStyle={{
          paddingTop: topBarHeight,
          paddingBottom: 84 + bottomNavPadding,
        }}
      >
        {/* Entity Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="border-b border-[#DDE4DF] bg-white"
          contentContainerStyle={{ paddingHorizontal: 8 }}
        >
          {ENTITY_TABS.map((tab) => {
            const isActive = tab.key === activeEntity;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveEntity(tab.key)}
                className="px-4 py-3"
                style={{
                  borderBottomWidth: 2,
                  borderBottomColor: isActive ? "#27BB97" : "transparent",
                }}
              >
                <Text
                  className="text-[12px] font-medium"
                  style={{ color: isActive ? "#27BB97" : "#6C7A74" }}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Sort & Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 16,
            gap: 8,
            paddingVertical: 16,
          }}
        >
          {SORT_OPTIONS.map((opt) => {
            const isActive = opt.key === activeSort;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setActiveSort(opt.key)}
                className="flex-row items-center gap-1 rounded-full px-3 py-1.5"
                style={{
                  backgroundColor: isActive ? "rgba(39,187,151,0.1)" : "#FFF",
                  borderWidth: 1,
                  borderColor: isActive ? "rgba(39,187,151,0.3)" : "#DDE4DF",
                }}
              >
                <Text
                  className="text-[12px] font-medium"
                  style={{ color: isActive ? "#27BB97" : "#3C4A44" }}
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
              })
            }
            className="flex-row items-center gap-1 rounded-full border border-[#27BB97]/20 bg-white px-3 py-1.5"
          >
            <MaterialIcons name="map" size={15} color="#27BB97" />
            <Text className="text-[12px] font-medium text-[#27BB97]">
              Nearby Map
            </Text>
          </Pressable>
        </ScrollView>

        {/* Results meta */}
        {pagination && (
          <View className="flex-row items-center justify-between px-5 pb-3">
            <Text className="text-[12px] text-[#6C7A74]">
              {pagination.total.toLocaleString()} results
              {source ? ` • ${source}` : ""}
            </Text>
          </View>
        )}

        {/* Loading */}
        {loading && (
          <View className="items-center py-16">
            <ActivityIndicator size="large" color="#27BB97" />
            <Text className="mt-3 text-[14px] text-[#6C7A74]">
              Searching...
            </Text>
          </View>
        )}

        {/* No results */}
        {!loading && results.length === 0 && (
          <View className="items-center py-16 px-8">
            <MaterialIcons name="search-off" size={56} color="#CBD5E1" />
            <Text className="mt-4 text-center text-[18px] font-semibold text-[#161D1A]">
              No results found
            </Text>
            <Text className="mt-2 text-center text-[14px] text-[#6C7A74]">
              Try different keywords or broaden your filters
            </Text>
          </View>
        )}

        {/* Results Grid */}
        {!loading && results.length > 0 && (
        <View
          className="flex-row flex-wrap"
          style={{
            paddingHorizontal: GRID_SIDE_PADDING,
            columnGap: GRID_GUTTER,
            rowGap: GRID_GUTTER,
          }}
        >
          {results.map((item) => (
            <Pressable
              key={`${item._entity}_${item._id}`}
              onPress={() => {
                const cat = item._entity;
                const specialRoutes: Record<string, string> = { events: "/event-detail", properties: "/property-detail", jobs: "/job-detail", services: "/service-detail" };
                const specialRoute = specialRoutes[cat];
                if (specialRoute) {
                  router.push({ pathname: specialRoute as any, params: { category: cat, id: item._id } });
                } else {
                  router.push({ pathname: "/listing-detail-template", params: { category: cat, id: item._id } });
                }
              }}
              className="overflow-hidden rounded-xl border border-[#E9EFEB] bg-white"
              style={{ width: CARD_WIDTH }}
            >
              <View style={{ width: CARD_WIDTH, height: CARD_WIDTH }}>
                {item.images?.[0] ? (
                  <Image
                    source={item.images[0]}
                    contentFit="cover"
                    transition={200}
                    className="h-full w-full"
                  />
                ) : (
                  <View className="h-full w-full items-center justify-center bg-slate-100">
                    <MaterialIcons name="image" size={40} color="#CBD5E1" />
                  </View>
                )}
                <Pressable className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-white/80">
                  <MaterialIcons
                    name="favorite-border"
                    size={18}
                    color="#161D1A"
                  />
                </Pressable>
                {item.distance != null && (
                  <View className="absolute bottom-2 left-2 rounded-md bg-white/90 px-2 py-0.5">
                    <Text className="text-[10px] font-bold text-[#161D1A]">
                      {item.distance} km
                    </Text>
                  </View>
                )}
              </View>

              <View className="flex-1 p-3">
                <Text
                  numberOfLines={1}
                  className="text-[14px] text-[#161D1A]"
                >
                  {item.title}
                </Text>
                {item.condition && (
                  <Text className="mt-0.5 text-[11px] text-[#6C7A74]">
                    {item.condition}
                  </Text>
                )}
                <View className="mt-2">
                  <Text className="text-[16px] font-bold text-[#27BB97]">
                    {item.price != null
                      ? `₹${Number(item.price).toLocaleString("en-IN")}`
                      : "Price on request"}
                  </Text>
                  {item.location && (
                    <View className="mt-1 flex-row items-center gap-1">
                      <MaterialIcons
                        name="location-on"
                        size={12}
                        color="#6C7A74"
                      />
                      <Text numberOfLines={1} className="text-[10px] text-[#6C7A74]">
                        {item.location}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          ))}
        </View>
        )}
      </ScrollView>

      <View
        className="absolute inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-slate-100 bg-white"
        style={{
          paddingTop: 12,
          paddingBottom: bottomNavPadding,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.05,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <View className="flex-row items-end justify-around px-2">
          {bottomTabs.map((tab) => {
            if (tab.highlight) {
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => handleBottomTabPress(tab.id)}
                  className="items-center justify-center"
                >
                  <View
                    className="-mt-7 rounded-full border-4 border-[#F4FBF6] bg-[#27BB97] p-2.5"
                    style={{
                      shadowColor: "#27BB97",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 6,
                    }}
                  >
                    <MaterialIcons name={tab.icon} size={24} color="#FFFFFF" />
                  </View>
                  <Text className="mt-1 text-[11px] font-medium tracking-wide text-slate-400">
                    {tab.label}
                  </Text>
                </Pressable>
              );
            }

            return (
              <Pressable
                key={tab.id}
                onPress={() => handleBottomTabPress(tab.id)}
                className="items-center py-1"
              >
                <MaterialIcons
                  name={tab.icon}
                  size={24}
                  color={tab.active ? "#27BB97" : "#94A3B8"}
                />
                <Text
                  className="text-[11px] font-medium tracking-wide"
                  style={{ color: tab.active ? "#27BB97" : "#94A3B8" }}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
