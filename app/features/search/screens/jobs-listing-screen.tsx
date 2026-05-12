import { MaterialIcons } from "@expo/vector-icons";
import { type Href, useRouter } from "@/lib/safe-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CATEGORY_MAP } from "@/constants/categories";
import {
  fetchCategoryListings,
  toggleSaveListing,
  type ListingItem,
} from "@/features/listing/services/listing-api";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { Image } from "@/lib/nativewind-interop";
import { useTabNavigation } from "@/lib/use-tab-navigation";
import { useAppSelector } from "@/store/hooks";

const CATEGORY_SLUG = "jobs" as const;
const jobConfig = CATEGORY_MAP[CATEGORY_SLUG];
const subcategories = ["All", ...(jobConfig?.subcategories ?? [])];

const bottomTabs = [
  { id: "home", label: "Home", icon: "home" as const },
  { id: "search", label: "Search", icon: "search" as const, active: true },
  { id: "sell", label: "Sell", icon: "add-circle" as const, highlight: true },
  { id: "messages", label: "Messages", icon: "chat-bubble" as const },
  { id: "profile", label: "Profile", icon: "person" as const },
];

function formatSalary(listing: ListingItem): string {
  const salary = (listing as any)?.salary;
  const currency = listing.currency ?? "\u20B9";
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

export function JobsListingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAppSelector((s) => s.auth.user);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChip, setSelectedChip] = useState("All");
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const topBarHeight = insets.top + 64;
  const handleBottomTabPress = useTabNavigation();

  const loadListings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchCategoryListings(CATEGORY_SLUG, {
        subcategory: selectedChip === "All" ? undefined : selectedChip,
        search: searchQuery.trim() || undefined,
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
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  }, [selectedChip, searchQuery, user?.id]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  const handleRefresh = useCallback(async () => {
    try {
      const res = await fetchCategoryListings(CATEGORY_SLUG, {
        subcategory: selectedChip === "All" ? undefined : selectedChip,
        search: searchQuery.trim() || undefined,
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
    } catch {
      // keep existing
    }
  }, [selectedChip, searchQuery, user?.id]);

  const { refreshing, onRefresh } = usePullToRefresh(handleRefresh);

  const handleToggleSave = useCallback(
    async (id: string) => {
      try {
        const res = await toggleSaveListing(CATEGORY_SLUG, id);
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (res.saved) next.add(id);
          else next.delete(id);
          return next;
        });
      } catch {}
    },
    [],
  );

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      {/* ===== TOP APP BAR ===== */}
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
            <MaterialIcons name="arrow-back" size={22} color="#0F172A" />
          </Pressable>
          <Text className="text-[20px] font-black tracking-tight text-[#27BB97]">
            Jobs
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/notifications-center")}
          className="h-10 w-10 items-center justify-center rounded-full"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <MaterialIcons name="notifications-none" size={24} color="#161D1A" />
        </Pressable>
      </View>

      {/* ===== SCROLLABLE CONTENT ===== */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#27BB97"]}
            tintColor="#27BB97"
            progressViewOffset={topBarHeight}
          />
        }
        contentContainerStyle={{
          paddingTop: topBarHeight + 16,
          paddingBottom: 80 + Math.max(insets.bottom, 16),
          paddingHorizontal: 16,
        }}
      >
        {/* Page Title */}
        <Text className="mb-4 text-[24px] font-bold tracking-tight text-[#161D1A]">
          Local Jobs
        </Text>

        {/* Search Bar */}
        <View className="relative mb-6">
          <View
            className="h-12 flex-row items-center rounded-xl border border-[#bbcac3] bg-white px-4"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 2,
              elevation: 1,
            }}
          >
            <MaterialIcons name="search" size={22} color="#6c7a74" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={loadListings}
              returnKeyType="search"
              placeholder="Search roles, companies, or keywords"
              placeholderTextColor="#6c7a74"
              className="ml-2 flex-1 text-[14px] leading-5 text-[#161D1A]"
              style={{ paddingVertical: 0 }}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => { setSearchQuery(""); }}>
                <MaterialIcons name="close" size={20} color="#94A3B8" />
              </Pressable>
            )}
          </View>
        </View>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
          className="mb-6"
        >
          {subcategories.map((chip) => {
            const isActive = selectedChip === chip;
            return (
              <Pressable
                key={chip}
                onPress={() => setSelectedChip(chip)}
                className="flex-row items-center gap-1.5 rounded-full px-4 py-2"
                style={
                  isActive
                    ? { backgroundColor: "#27BB97" }
                    : { backgroundColor: "#e3eae5" }
                }
              >
                <Text
                  className="text-[12px] font-medium tracking-wide"
                  style={{ color: isActive ? "#FFFFFF" : "#3c4a44" }}
                >
                  {chip}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Job Cards */}
        {loading ? (
          <View className="items-center py-16">
            <ActivityIndicator size="large" color="#27BB97" />
            <Text className="mt-3 text-[14px] text-[#6C7A74]">Loading jobs...</Text>
          </View>
        ) : listings.length === 0 ? (
          <View className="items-center py-16">
            <MaterialIcons name="work-off" size={56} color="#CBD5E1" />
            <Text className="mt-3 text-[16px] font-semibold text-[#161D1A]">
              No jobs found
            </Text>
            <Text className="mt-1 text-center text-[13px] text-[#6C7A74]">
              Be the first to post a job listing!
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {listings.map((job) => {
              const companyName = (job as any).companyName ?? job.sellerName ?? "";
              const companyLogo = (job as any).companyLogo ?? null;
              const jobType = (job as any).jobType ?? "";
              const workMode = (job as any).workMode ?? "";
              const isSaved = savedIds.has(job._id);
              const salaryText = formatSalary(job);
              const isNew = job.createdAt
                ? Date.now() - new Date(job.createdAt).getTime() < 3 * 24 * 60 * 60 * 1000
                : false;

              return (
                <Pressable
                  key={job._id}
                  onPress={() =>
                    router.push(
                      `/job-detail?id=${job._id}&category=jobs` as Href,
                    )
                  }
                  className="rounded-xl border border-slate-100 bg-white p-4"
                  style={({ pressed }) => ({
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 3,
                    elevation: 2,
                  })}
                >
                  {/* Header: Logo + Title + Badge */}
                  <View className="mb-4 flex-row items-start justify-between">
                    <View className="flex-1 flex-row gap-3">
                      <View className="h-12 w-12 overflow-hidden rounded-lg border border-[#bbcac3]/30 bg-[#e9efeb]">
                        {companyLogo ? (
                          <Image
                            source={companyLogo}
                            contentFit="cover"
                            transition={200}
                            className="h-full w-full"
                          />
                        ) : (
                          <View className="h-full w-full items-center justify-center">
                            <MaterialIcons name="business" size={24} color="#6C7A74" />
                          </View>
                        )}
                      </View>
                      <View className="shrink">
                        <Text
                          numberOfLines={2}
                          className="text-[18px] font-semibold leading-6 text-[#161D1A]"
                        >
                          {job.title}
                        </Text>
                        <Text className="text-[14px] leading-5 text-[#6c7a74]">
                          {companyName}
                        </Text>
                      </View>
                    </View>
                    {isNew && (
                      <View className="ml-2 rounded bg-[#006b55]/10 px-2 py-1">
                        <Text className="text-[10px] font-bold uppercase tracking-wider text-[#006b55]">
                          New
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Meta badges */}
                  {(jobType || workMode) ? (
                    <View className="mb-3 flex-row flex-wrap gap-2">
                      {jobType ? (
                        <View className="flex-row items-center gap-1 rounded-full bg-[#27BB97]/10 px-2.5 py-0.5">
                          <MaterialIcons name="work" size={12} color="#27BB97" />
                          <Text className="text-[11px] font-medium text-[#27BB97]">{jobType}</Text>
                        </View>
                      ) : null}
                      {workMode ? (
                        <View className="flex-row items-center gap-1 rounded-full bg-[#5ba2ff]/10 px-2.5 py-0.5">
                          <MaterialIcons name="wifi" size={12} color="#5ba2ff" />
                          <Text className="text-[11px] font-medium text-[#5ba2ff]">{workMode}</Text>
                        </View>
                      ) : null}
                      {job.subcategory ? (
                        <View className="flex-row items-center gap-1 rounded-full bg-[#f0e6ff] px-2.5 py-0.5">
                          <Text className="text-[11px] font-medium text-[#7C3AED]">{job.subcategory}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {/* Salary & Location */}
                  <View className="mb-4 gap-1">
                    <View className="flex-row items-center gap-2">
                      <MaterialIcons name="payments" size={18} color="#6c7a74" />
                      <Text className="text-[16px] font-bold leading-5 text-[#161D1A]">
                        {salaryText}
                      </Text>
                    </View>
                    {job.location ? (
                      <View className="flex-row items-center gap-2">
                        <MaterialIcons name="location-on" size={18} color="#6c7a74" />
                        <Text
                          numberOfLines={1}
                          className="flex-1 text-[14px] leading-5 text-[#6c7a74]"
                        >
                          {job.location}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Action Buttons */}
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() =>
                        router.push(
                          `/job-detail?id=${job._id}&category=jobs` as Href,
                        )
                      }
                      className="flex-1 items-center rounded-lg bg-[#27BB97] py-2.5"
                      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
                    >
                      <Text className="text-[12px] font-medium tracking-wide text-white">
                        View Details
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleToggleSave(job._id)}
                      className="w-10 items-center justify-center rounded-lg border border-[#bbcac3]"
                      style={({ pressed }) => ({
                        backgroundColor: pressed ? "#F4FBF6" : "transparent",
                      })}
                    >
                      <MaterialIcons
                        name={isSaved ? "bookmark" : "bookmark-outline"}
                        size={20}
                        color={isSaved ? "#27BB97" : "#161D1A"}
                      />
                    </Pressable>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ===== BOTTOM NAVIGATION BAR ===== */}
      <View
        className="absolute inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-slate-100 bg-white"
        style={{
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 12,
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
                className="items-center justify-center py-1"
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
