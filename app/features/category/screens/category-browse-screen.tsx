import { MaterialIcons } from "@expo/vector-icons";
import { type Href, useRouter } from "@/lib/safe-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ListingItemsGridCard } from "@/components/listing-items-grid-card";
import { VoiceSearchModal } from "@/components/voice-search-modal";
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
import { selectLocationCoords, selectLocationLabel } from "@/store/slices/location-slice";

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

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildCalendarGrid(month: Date): (Date | null)[][] {
  const year = month.getFullYear();
  const m = month.getMonth();
  const firstDay = new Date(year, m, 1).getDay();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const cells: (Date | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, m, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

type CategoryBrowseScreenProps = {
  categorySlug: CategorySlug;
};

export function CategoryBrowseScreen({ categorySlug }: CategoryBrowseScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAppSelector((s) => s.auth.user);
  const userCoords = useAppSelector(selectLocationCoords);
  const locationLabel = useAppSelector(selectLocationLabel);

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
  const [voiceVisible, setVoiceVisible] = useState(false);
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());

  const [calendarDates, setCalendarDates] = useState<Date[]>(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      return d;
    });
  });

  const headerHeight = insets.top + 12 + 52;
  const categoryTabsHeight = 52;
  const eventsTitleHeight = layout === "events" ? 64 : 0;
  const datePickerHeight = layout === "events" ? 96 : 0;
  const stickyOffset = headerHeight + eventsTitleHeight + datePickerHeight + categoryTabsHeight;

  const loadListings = useCallback(async () => {
    try {
      const hasCoords = userCoords.lat != null && userCoords.lng != null;

      // Only filter by location when the user has actually set one.
      // "Set location" / "Detecting location…" are UI placeholders \u2014 passing
      // them to the server as a text filter returns 0 results.
      const isRealLabel =
        Boolean(locationLabel) &&
        locationLabel !== "Set location" &&
        !locationLabel.startsWith("Detecting");
      const locationForApi = isRealLabel
        ? locationLabel.split(",").map((p) => p.trim()).filter(Boolean).slice(0, 2).join(", ") || undefined
        : undefined;

      const res = await Promise.race([
        fetchCategoryListings(categorySlug, {
          subcategory: selectedSubcategory === "All" ? undefined : selectedSubcategory,
          search: appliedSearch.trim() || undefined,
          location: locationForApi,
          lat: hasCoords ? userCoords.lat! : undefined,
          lng: hasCoords ? userCoords.lng! : undefined,
          radius: hasCoords ? 100 : undefined,
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
  }, [appliedSearch, categorySlug, locationLabel, selectedSubcategory, user?.id, userCoords.lat, userCoords.lng]);

  // Fire on subcategory / search changes (screen already mounted)
  useEffect(() => {
    void loadListings();
  }, [loadListings]);

  // Also fire when the screen regains focus (e.g. after posting a new listing),
  // but skip the very first focus because useEffect handles the initial load.
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

  const handleVoiceResult = useCallback((text: string) => {
    setSearchQuery(text);
    setAppliedSearch(text);
  }, []);

  const calendarGrid = useMemo(() => buildCalendarGrid(calendarMonth), [calendarMonth]);
  const selectedCalendarDate = calendarDates[selectedDateIndex] ?? calendarDates[0];

  const navigateCalendarMonth = useCallback((dir: number) => {
    setCalendarMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + dir);
      return next;
    });
  }, []);

  const onPickCalendarDate = useCallback((date: Date) => {
    const newDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(date);
      d.setDate(date.getDate() + i);
      return d;
    });
    setCalendarDates(newDates);
    setSelectedDateIndex(0);
    setCalendarMonth(date);
    setShowCalendar(false);
  }, []);

  const listingRows = useMemo(() => {
    const rows: ListingItem[][] = [];
    for (let i = 0; i < displayListings.length; i += 2) {
      rows.push(displayListings.slice(i, i + 2));
    }
    return rows;
  }, [displayListings]);

  return (
    <View className="flex-1" style={{ backgroundColor: BG }}>
      <VoiceSearchModal
        visible={voiceVisible}
        onResult={handleVoiceResult}
        onClose={() => setVoiceVisible(false)}
      />
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

      {layout === "events" ? (
        <View
          className="absolute inset-x-0 z-45 px-4"
          style={{
            top: headerHeight,
            height: eventsTitleHeight,
            backgroundColor: BG,
            paddingVertical: 16,
          }}
        >
          <Text
            style={{
              fontFamily: ListifyFonts.bold,
              fontSize: 24,
              lineHeight: 32,
              letterSpacing: -0.02 * 24,
              fontWeight: "700",
              color: "#161D1A",
            }}
          >
            Upcoming Events
          </Text>
        </View>
      ) : null}

      {layout === "events" ? (
        <View
          className="absolute inset-x-0 z-44"
          style={{ top: headerHeight + eventsTitleHeight, height: datePickerHeight, backgroundColor: BG }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: GRID_SIDE_PADDING,
              gap: 8,
              paddingVertical: 12,
            }}
          >
            {calendarDates.map((d, idx) => {
              const isActiveDate = idx === selectedDateIndex;
              const monthLabel = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
              const dayLabel = d.getDate().toString();
              return (
                <Pressable
                  key={idx}
                  onPress={() => setSelectedDateIndex(idx)}
                  android_ripple={{ color: "rgba(255,255,255,0.3)", borderless: false, radius: 28 }}
                  className="items-center justify-center rounded-xl"
                  style={{
                    width: 56,
                    height: 72,
                    backgroundColor: isActiveDate ? "#27BB97" : "#FFFFFF",
                    borderWidth: 1,
                    borderColor: isActiveDate ? "#27BB97" : "#D1D5DB",
                    shadowColor: "#27BB97",
                    shadowOffset: { width: 0, height: isActiveDate ? 4 : 0 },
                    shadowOpacity: isActiveDate ? 0.3 : 0,
                    shadowRadius: isActiveDate ? 8 : 0,
                    elevation: isActiveDate ? 4 : 0,
                  }}
                >
                  <Text
                    className="text-[11px]"
                    style={{
                      fontFamily: ListifyFonts.medium,
                      color: isActiveDate ? "rgba(255,255,255,0.85)" : "#6C7A74",
                      letterSpacing: 0.5,
                    }}
                  >
                    {monthLabel}
                  </Text>
                  <Text
                    className="text-[22px]"
                    style={{
                      fontFamily: ListifyFonts.bold,
                      color: isActiveDate ? "#FFFFFF" : "#161D1A",
                    }}
                  >
                    {dayLabel}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setShowCalendar(true)}
              style={{ width: 48, alignItems: "center", justifyContent: "center" }}
              hitSlop={8}
            >
              <MaterialIcons name="calendar-month" size={24} color="#27BB97" />
            </Pressable>
          </ScrollView>
        </View>
      ) : null}

      <View
        className="absolute inset-x-0 z-40 bg-[#F6F7F8]"
        style={{ top: headerHeight + eventsTitleHeight + datePickerHeight, height: categoryTabsHeight }}
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
        {layout !== "events" ? (
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
        ) : null}

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
              {locationLabel && locationLabel !== "Set location" ? ` in ${locationLabel.split(",")[0]}` : ""}
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
          <View>
            {/* Event cards */}
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

      {/* Calendar Month Picker Modal */}
      <Modal
        visible={showCalendar}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCalendar(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }}
          onPress={() => setShowCalendar(false)}
        />
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: Math.max(insets.bottom, 20),
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
          }}
        >
          {/* Handle bar */}
          <View style={{ alignItems: "center", marginBottom: 16 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "#D1D5DB" }} />
          </View>

          {/* Month navigation */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <Pressable onPress={() => navigateCalendarMonth(-1)} hitSlop={12} style={{ padding: 4 }}>
              <MaterialIcons name="chevron-left" size={28} color="#161D1A" />
            </Pressable>
            <Text style={{ fontFamily: ListifyFonts.bold, fontSize: 18, color: "#161D1A" }}>
              {calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </Text>
            <Pressable onPress={() => navigateCalendarMonth(1)} hitSlop={12} style={{ padding: 4 }}>
              <MaterialIcons name="chevron-right" size={28} color="#161D1A" />
            </Pressable>
          </View>

          {/* Day-of-week headers */}
          <View style={{ flexDirection: "row", marginBottom: 8 }}>
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <View key={i} style={{ flex: 1, alignItems: "center" }}>
                <Text style={{ fontFamily: ListifyFonts.medium, fontSize: 12, color: "#6C7A74" }}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Day grid */}
          {calendarGrid.map((week, wi) => (
            <View key={wi} style={{ flexDirection: "row", marginBottom: 4 }}>
              {week.map((day, di) => {
                const isToday = day ? isSameDay(day, new Date()) : false;
                const isPicked = day ? isSameDay(day, selectedCalendarDate) : false;
                return (
                  <Pressable
                    key={di}
                    onPress={() => day && onPickCalendarDate(day)}
                    style={{ flex: 1, alignItems: "center", paddingVertical: 6 }}
                  >
                    {day ? (
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: isPicked
                            ? "#27BB97"
                            : isToday
                            ? "rgba(39,187,151,0.12)"
                            : "transparent",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: ListifyFonts.medium,
                            fontSize: 14,
                            color: isPicked ? "#FFFFFF" : isToday ? "#27BB97" : "#161D1A",
                          }}
                        >
                          {day.getDate()}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </Modal>
    </View>
  );
}
