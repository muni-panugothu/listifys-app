import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { Image } from "@/lib/nativewind-interop";

type EventItem = {
  id: string;
  title: string;
  date: string;
  location: string;
  price: string;
  actionLabel: string;
  image: string;
  trending?: boolean;
  liked?: boolean;
};

const calendarDates = [
  { day: "12", month: "OCT", active: true },
  { day: "13", month: "OCT" },
  { day: "14", month: "OCT" },
  { day: "15", month: "OCT" },
  { day: "16", month: "OCT" },
  { day: "17", month: "OCT" },
];

const categoryChips = [
  { id: "all", label: "All Events" },
  { id: "music", label: "Music" },
  { id: "workshops", label: "Workshops" },
  { id: "sports", label: "Sports" },
  { id: "networking", label: "Networking" },
];

const events: EventItem[] = [
  {
    id: "neon-pulse",
    title: "Neon Pulse: Underground Music Festival",
    date: "Oct 12 • 07:00 PM onwards",
    location: "The Warehouse District, South Mumbai",
    price: "₹999 onwards",
    actionLabel: "Book Now",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCTjGpVoWp6gxrW3HnWt-tD4j4A-Z2Y4_CV71RGDdO1Ll9VG6k7TQYrV2flLsBS3IQX9F4gKYZWSDjjabJ_EX_FORlR41ABY0dh6S4vYfo0kgwzU9OpP-4eo8MhdQy-bqeivTLkSMjoBr1244BCwGSuREcAiERx2FRHyrJQkC1kmc-n9VMeR2IleAKxDywj7zPoSb4PBH4IeLP9Xh6wWxTwvOlE9bn7yHCS3fmxVsBklbiAHkgAqpbiVedQ75-Uy53tw9pD1Auj-7w",
    trending: true,
    liked: true,
  },
  {
    id: "pottery-workshop",
    title: "Artisan Pottery & Glazing Workshop",
    date: "Oct 13 • 10:00 AM",
    location: "The Creative Hub, Bandra West",
    price: "₹500 onwards",
    actionLabel: "Book Now",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuC6eJDHR53_Al6hiUIACcaClkQmX8CLwZs-aVs7liU5uKaHjk_MmZmn0siGrJT57u91pj9Z31GwtUKrQXB_Cp27geIAQhro26qkQ8MS3_06c0oUR3BSH3vxE1Fxsp5h1z5t-eacjXpBY4WBi3TukXi773wWk7lqbqpwJcSquy_uEJYRpVbcWaRmtYpy9hRuyQqrRzj333cC03OmF0NjqKctbv52ubxeVvU0TNowFym-rveBWCQZlmh3AKNmvcmL1-1oCvWA4BpcLr0",
    liked: false,
  },
  {
    id: "tech-meetup",
    title: "Tech Founders Meetup: AI in 2024",
    date: "Oct 15 • 06:30 PM",
    location: "Innovation Park, HSR Layout",
    price: "FREE",
    actionLabel: "RSVP",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDkBFg6KX9oXuI4mGKzgvyWIZhACwMTesQrMPjSJV7MsBLCVBe6UWs6b-2WxykuPnCWibM31nQat8NQTtjm0GxQzFdK3mw9fIVeNVtMuEOVmQt-ukAMMQjspJYItVi6JgCYGOopRG_UGJLm9LoCmcFbK6SoOKtr0sANq7b9p5brF-CCMd5HeB3VQc5MhKFloguNOUDcotTf7CQzRrGroXdAv_MDD8rKNhV-vNePwVr8TavTmSG6iTf3fZdEq7onp0Osx-xzfrqdouA",
    liked: false,
  },
  {
    id: "badminton-open",
    title: "Open Smash: Amateur Badminton Open",
    date: "Oct 16 • 07:00 AM",
    location: "Skyline Sports Arena, Koramangala",
    price: "₹750 onwards",
    actionLabel: "Register",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBIDMHKtLl1wy0dv_UN2woK-TeV33Wc7PNm9_UfBpP45JoQAWnm9jvNEUXhQn1okIcRnctJwYQIvu6M80Ju14sIePMbKIs5_6KXACg52YFNo0oe8XiGvlYM6FdDHMMNPh-hXbaC8m-Q6E-DHwCARgtyMxwDP_1B-NfjxkbfO3iN1TtnEGGkGHM6MUoWVjwBPErud_REDckZcT1Tq6WjAZusA6a_YKcJjtNwp8AQzG7NWzIwey5MbXQChIKQuV-JwJFs3QOTNHTQ59g",
    trending: true,
    liked: false,
  },
];

const bottomTabs = [
  { id: "home", label: "Home", icon: "home" as const },
  { id: "search", label: "Search", icon: "search" as const, active: true },
  { id: "sell", label: "Sell", icon: "add-circle" as const, highlight: true },
  { id: "messages", label: "Messages", icon: "chat-bubble" as const },
  { id: "profile", label: "Profile", icon: "person" as const },
];

export function EventsListingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refreshing, onRefresh } = usePullToRefresh();
  const [selectedDate, setSelectedDate] = useState("12");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const topBarHeight = insets.top + 64;

  const handleBottomTabPress = (tabId: string) => {
    if (tabId === "home") {
      router.push("/home-feed-root");
      return;
    }
    if (tabId === "sell") {
      router.push("/sell-entry");
      return;
    }
    if (tabId === "search") {
      router.push("/search-home");
      return;
    }

    if (tabId === "messages") {
      router.push("/messages-inbox");
      return;
    }

    if (tabId === "profile") {
      router.push("/dashboard-home");
      return;
    }
  };

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
        <View className="flex-row items-center gap-4">
          <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <MaterialIcons name="search" size={24} color="#64748B" />
          </Pressable>
          <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <MaterialIcons
              name="notifications-none"
              size={24}
              color="#64748B"
            />
          </Pressable>
        </View>
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
          Upcoming Events
        </Text>

        {/* Calendar Date Picker */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 8 }}
          className="mb-6"
        >
          {calendarDates.map((date) => {
            const isActive = selectedDate === date.day;
            return (
              <Pressable
                key={date.day}
                onPress={() => setSelectedDate(date.day)}
                className="h-18 w-14 items-center justify-center rounded-xl"
                style={
                  isActive
                    ? {
                        backgroundColor: "#27BB97",
                        shadowColor: "#27BB97",
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.3,
                        shadowRadius: 6,
                        elevation: 4,
                      }
                    : {
                        backgroundColor: "#FFFFFF",
                        borderWidth: 1,
                        borderColor: "rgba(187,202,195,0.3)",
                      }
                }
              >
                <Text
                  className="text-[12px] font-medium tracking-wide"
                  style={{
                    color: isActive ? "rgba(255,255,255,0.8)" : "#6c7a74",
                  }}
                >
                  {date.month}
                </Text>
                <Text
                  className="text-[20px] font-semibold"
                  style={{ color: isActive ? "#FFFFFF" : "#161D1A" }}
                >
                  {date.day}
                </Text>
              </Pressable>
            );
          })}
          {/* Calendar Icon */}
          <View className="items-center justify-center px-4">
            <MaterialIcons name="calendar-month" size={24} color="#6c7a74" />
          </View>
        </ScrollView>

        {/* Category Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
          className="mb-6"
        >
          {categoryChips.map((chip) => {
            const isActive = selectedCategory === chip.id;
            return (
              <Pressable
                key={chip.id}
                onPress={() => setSelectedCategory(chip.id)}
                className="rounded-full px-5 py-2"
                style={
                  isActive
                    ? { backgroundColor: "#161D1A" }
                    : {
                        backgroundColor: "#FFFFFF",
                        borderWidth: 1,
                        borderColor: "rgba(187,202,195,0.3)",
                      }
                }
              >
                <Text
                  className="text-[12px] font-medium tracking-wide"
                  style={{ color: isActive ? "#FFFFFF" : "#161D1A" }}
                >
                  {chip.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Event Cards */}
        <View className="gap-3">
          {events.map((event) => (
            <Pressable
              key={event.id}
              onPress={() => router.push("/event-detail")}
              className="overflow-hidden rounded-xl border border-slate-100 bg-white"
              style={({ pressed }) => ({
                transform: [{ scale: pressed ? 0.98 : 1 }],
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 3,
                elevation: 2,
              })}
            >
              {/* Event Image */}
              <View className="relative h-56 w-full">
                <Image
                  source={event.image}
                  contentFit="cover"
                  transition={200}
                  className="h-full w-full"
                />
                {/* Trending Badge */}
                {event.trending && (
                  <View
                    className="absolute left-3 top-3 rounded-full bg-[#27BB97] px-3 py-1"
                    style={{
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.2,
                      shadowRadius: 4,
                      elevation: 4,
                    }}
                  >
                    <Text className="text-[10px] font-bold uppercase tracking-widest text-white">
                      Trending
                    </Text>
                  </View>
                )}
                {/* Favorite Button */}
                <Pressable
                  className="absolute right-3 top-3 h-10 w-10 items-center justify-center rounded-full border border-white/50 bg-white/70"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <MaterialIcons
                    name={event.liked ? "favorite" : "favorite-border"}
                    size={20}
                    color={event.liked ? "#ba1a1a" : "#161D1A"}
                  />
                </Pressable>
              </View>

              {/* Event Info */}
              <View className="p-4">
                {/* Date/Time */}
                <View className="mb-1 flex-row items-center gap-1">
                  <MaterialIcons name="schedule" size={14} color="#27BB97" />
                  <Text className="text-[12px] font-medium tracking-wide text-[#27BB97]">
                    {event.date}
                  </Text>
                </View>

                {/* Title */}
                <Text className="mb-1 text-[18px] font-semibold leading-6 text-[#161D1A]">
                  {event.title}
                </Text>

                {/* Location */}
                <View className="mb-4 flex-row items-center gap-1">
                  <MaterialIcons name="location-on" size={16} color="#6c7a74" />
                  <Text className="text-[14px] leading-5 text-[#6c7a74]">
                    {event.location}
                  </Text>
                </View>

                {/* Price & Action */}
                <View className="flex-row items-end justify-between border-t border-slate-50 pt-3">
                  <View>
                    <Text className="text-[12px] font-medium tracking-wide text-[#6c7a74]">
                      Entry Price
                    </Text>
                    <Text className="text-[16px] font-bold leading-5 text-[#161D1A]">
                      {event.price}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => router.push("/event-detail")}
                    className="rounded-lg bg-[#27BB97] px-6 py-2"
                    style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
                  >
                    <Text className="text-[12px] font-semibold text-white">
                      {event.actionLabel}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* ===== FLOATING ACTION BUTTON ===== */}
      <Pressable
        className="absolute z-40 h-14 w-14 items-center justify-center rounded-full bg-[#27BB97]"
        style={{
          right: 24,
          bottom: 96 + Math.max(insets.bottom, 8),
          shadowColor: "#27BB97",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 6,
        }}
      >
        <MaterialIcons name="filter-list" size={24} color="#FFFFFF" />
      </Pressable>

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
