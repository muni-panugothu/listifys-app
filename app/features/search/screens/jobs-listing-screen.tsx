import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "@/lib/safe-router";
import { useState } from "react";
import {
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { Image } from "@/lib/nativewind-interop";
import { useTabNavigation } from "@/lib/use-tab-navigation";

type JobItem = {
  id: string;
  title: string;
  company: string;
  salary: string;
  location: string;
  logo: string;
  isNew?: boolean;
};

const categoryChips = [
  {
    id: "quick-apply",
    label: "Quick apply",
    icon: "bolt" as const,
    active: true,
  },
  { id: "it", label: "IT" },
  { id: "sales", label: "Sales" },
  { id: "creative", label: "Creative" },
  { id: "delivery", label: "Delivery" },
  { id: "hospitality", label: "Hospitality" },
];

const jobs: JobItem[] = [
  {
    id: "senior-ui-designer",
    title: "Senior UI Designer",
    company: "Lumina Studios",
    salary: "₹45k - ₹65k",
    location: "Indiranagar, Bangalore",
    logo: "https://lh3.googleusercontent.com/aida-public/AB6AXuBsk_mg79Q7tjiqGt2r0o0rwNC6XW3HN7RTsvYCj4LRT3y2kd2AFgixgiGyFEIkETpK3L4atvB042-b0g4qMrAw5qv4cp00TBdASwRRpAPDYw9tlOQHyxDUTFuWDYMWKxYpI1cLsDQBZ6WboC4q0nTm-nsotsqaQ6cGJMenPZDyH1FJhHWonsCcA67bgtJKmfmZ94O1r5TbOVcaJVZvyFH8korrPOzf35euTU-tLiNr5ly9q77Qr3cCSqLS9HAcdCqyg8XXVBLkG5U",
    isNew: true,
  },
  {
    id: "delivery-lead",
    title: "Delivery Lead",
    company: "SwiftLogistics",
    salary: "₹25k - ₹40k",
    location: "Powai, Mumbai",
    logo: "https://lh3.googleusercontent.com/aida-public/AB6AXuChwNV8lvpsS114wZo79EpG5TP84Ejc4RdyKbpmrvVBEhB3QMk6ATzhOwMG7f2BF5OpEA6tRVunbRoNYqh1w63E4b-K6msDI2ZyKfEt4z9n6dAd6Q5XgRVhTs-G5w3u8NZDnQrHY5j0uNoKr--altwpRvPwWvsKjktHnxYbHRN7iUn1-5zndCipX7z1UDDLJpfs8Pi_xAO6kXcaS92U3cThmOY30IjrTGxkJWV1F1SwkEgXnHWh2N311Zd1DKkMMaAIGLzUBKE3s6Y",
    isNew: false,
  },
  {
    id: "floor-manager",
    title: "Floor Manager",
    company: "The Heritage Hotel",
    salary: "₹35k - ₹50k",
    location: "Cyber Hub, Gurgaon",
    logo: "https://lh3.googleusercontent.com/aida-public/AB6AXuDBARuXS_5J8aH0aiMtSc52BXzCcvZ_bcCfJkvgGxWwK8ihntY3UiYL2AXNKYTXDGzTRHDqRbXxwZg856Wnzk-43fJbzx4bp_h4JijuKc-u37Efq48QWxR69RrrDpCOzIMUgXErSGnawohkmXYCMM5yuF_sZml_0ScCV1Kis2_WECKRleQ44aORVS_HZNGl4TgNbHmd7dYLNXdMGUuwhzgv4gqN7L8S0JscjNS5n04anM74rMcEE5vkXQI9glR2os-Dq3GtqYpwqFc",
    isNew: true,
  },
  {
    id: "social-media-manager",
    title: "Social Media Manager",
    company: "Buzz Media",
    salary: "₹30k - ₹45k",
    location: "Koregaon Park, Pune",
    logo: "https://lh3.googleusercontent.com/aida-public/AB6AXuAF-B2IXw63eKb_q6yQz7Olb-1acazTPCkWuJDDiHm3wg2I1ZXKjHJr9Le6IGwMKq0CiJ7fcHvWXzm2Z5Ga3aEfpdKPhmqzSj2NWejwhLY9IkB4zYwPvzGkr3Zx0V8u25HIRPxCjwSyuB1mgVSoaoHLh1OFQJMysTcdzAeJQE9UlPPnHoOnyRec_ltE8a1LiRzwQnfQCuDr4AsxH1jQnojJKW0FdGR73YMBU0fJ2DaW1uZYvhQX6kK40YrIdbEPTZNoizfD22O3ouA",
    isNew: false,
  },
];

const bottomTabs = [
  { id: "home", label: "Home", icon: "home" as const },
  { id: "search", label: "Search", icon: "search" as const, active: true },
  { id: "sell", label: "Sell", icon: "add-circle" as const, highlight: true },
  { id: "messages", label: "Messages", icon: "chat-bubble" as const },
  { id: "profile", label: "Profile", icon: "person" as const },
];

export function JobsListingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refreshing, onRefresh } = usePullToRefresh();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChip, setSelectedChip] = useState("quick-apply");

  const topBarHeight = insets.top + 64;

  const handleBottomTabPress = useTabNavigation();

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
        <View className="flex-row items-center gap-2">
          <MaterialIcons name="storefront" size={26} color="#27BB97" />
          <Text className="text-[20px] font-black tracking-tight text-[#27BB97]">
            Listify
          </Text>
        </View>
        <Pressable
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
              placeholder="Search roles, companies, or keywords"
              placeholderTextColor="#6c7a74"
              className="ml-2 flex-1 text-[14px] leading-5 text-[#161D1A]"
              style={{ paddingVertical: 0 }}
            />
          </View>
        </View>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingBottom: 8 }}
          className="mb-6"
        >
          {categoryChips.map((chip) => {
            const isActive = selectedChip === chip.id;
            return (
              <Pressable
                key={chip.id}
                onPress={() => setSelectedChip(chip.id)}
                className="flex-row items-center gap-1.5 rounded-full px-4 py-2"
                style={
                  isActive
                    ? { backgroundColor: "#27BB97" }
                    : { backgroundColor: "#e3eae5" }
                }
              >
                {chip.icon && (
                  <MaterialIcons
                    name={chip.icon}
                    size={16}
                    color={isActive ? "#FFFFFF" : "#3c4a44"}
                  />
                )}
                <Text
                  className="text-[12px] font-medium tracking-wide"
                  style={{ color: isActive ? "#FFFFFF" : "#3c4a44" }}
                >
                  {chip.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Job Cards */}
        <View className="gap-3">
          {jobs.map((job) => (
            <Pressable
              key={job.id}
              onPress={() => router.push("/job-detail")}
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
                <View className="flex-row gap-3">
                  <View className="h-12 w-12 overflow-hidden rounded-lg border border-[#bbcac3]/30 bg-[#e9efeb]">
                    <Image
                      source={job.logo}
                      contentFit="cover"
                      transition={200}
                      className="h-full w-full"
                    />
                  </View>
                  <View className="shrink">
                    <Text className="text-[18px] font-semibold leading-6 text-[#161D1A]">
                      {job.title}
                    </Text>
                    <Text className="text-[14px] leading-5 text-[#6c7a74]">
                      {job.company}
                    </Text>
                  </View>
                </View>
                {job.isNew && (
                  <View className="rounded bg-[#006b55]/10 px-2 py-1">
                    <Text className="text-[10px] font-bold uppercase tracking-wider text-[#006b55]">
                      New
                    </Text>
                  </View>
                )}
              </View>

              {/* Salary & Location */}
              <View className="mb-4 gap-1">
                <View className="flex-row items-center gap-2">
                  <MaterialIcons name="payments" size={18} color="#6c7a74" />
                  <Text className="text-[16px] font-bold leading-5 text-[#161D1A]">
                    {job.salary}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <MaterialIcons name="location-on" size={18} color="#6c7a74" />
                  <Text className="text-[14px] leading-5 text-[#6c7a74]">
                    {job.location}
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-2">
                <Pressable
                  className="flex-1 items-center rounded-lg bg-[#27BB97] py-2.5"
                  style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
                >
                  <Text className="text-[12px] font-medium tracking-wide text-white">
                    Quick Apply
                  </Text>
                </Pressable>
                <Pressable
                  className="w-10 items-center justify-center rounded-lg border border-[#bbcac3]"
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? "#F4FBF6" : "transparent",
                  })}
                >
                  <MaterialIcons
                    name="bookmark-outline"
                    size={20}
                    color="#161D1A"
                  />
                </Pressable>
              </View>
            </Pressable>
          ))}
        </View>
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
