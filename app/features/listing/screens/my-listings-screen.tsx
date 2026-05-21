import { MaterialIcons } from "@expo/vector-icons";
import { type Href, useFocusEffect, useRouter } from "@/lib/safe-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";

import { MyListingManageCard } from "@/components/my-listing-manage-card";
import { MyListingsTabs, type MyListingsTab } from "@/components/my-listings-tabs";
import { ProfileSubScreenLayout } from "@/components/profile-sub-screen-layout";
import { type CategorySlug } from "@/constants/categories";
import { ListifyFonts } from "@/constants/typography";
import { deleteListing, fetchMyListings, type ListingItem } from "@/features/listing/services/listing-api";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { formatTimeAgo } from "@/lib/format-time-ago";
import { showErrorToast } from "@/lib/toast";

const SPECIAL_DETAIL_ROUTES: Record<string, string> = {
  events: "/event-detail",
  properties: "/property-detail",
  jobs: "/job-detail",
  services: "/service-detail",
};

function getCategory(listing: ListingItem) {
  return (listing as ListingItem & { _source?: string })._source ?? listing.category;
}

type MyListingsScreenProps = {
  initialTab?: MyListingsTab;
};

export function MyListingsScreen({ initialTab = "Active" }: MyListingsScreenProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<MyListingsTab>(initialTab);
  const [allListings, setAllListings] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadListings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchMyListings();
      setAllListings(res.listings || []);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadListings();
    }, [loadListings]),
  );

  const { refreshing, onRefresh } = usePullToRefresh(loadListings);

  const activeListings = useMemo(
    () => allListings.filter((l) => l.status === "active" || !l.status),
    [allListings],
  );
  const expiredListings = useMemo(
    () => allListings.filter((l) => l.status === "expired" || l.status === "sold"),
    [allListings],
  );
  const draftListings = useMemo(
    () => allListings.filter((l) => l.status === "draft"),
    [allListings],
  );

  const visibleListings =
    activeTab === "Active"
      ? activeListings
      : activeTab === "Expired"
        ? expiredListings
        : draftListings;

  const openDetail = useCallback(
    (listing: ListingItem) => {
      const cat = getCategory(listing);
      const specialRoute = SPECIAL_DETAIL_ROUTES[cat];
      if (specialRoute) {
        router.push(`${specialRoute}?id=${listing._id}&category=${cat}` as Href);
      } else {
        router.push(`/listing-detail-template?category=${cat}&id=${listing._id}` as Href);
      }
    },
    [router],
  );

  const handleEditListing = useCallback(
    (listing: ListingItem) => {
      const category = getCategory(listing) as CategorySlug;
      router.push(`/edit-listing?category=${category}&id=${listing._id}` as Href);
    },
    [router],
  );

  const handleDeleteListing = useCallback(
    (listing: ListingItem, isDraft: boolean) => {
      const category = getCategory(listing) as CategorySlug;
      Alert.alert(
        isDraft ? "Delete draft" : "Delete listing",
        isDraft
          ? `Delete "${listing.title || "Untitled draft"}"?`
          : `Delete "${listing.title}"? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteListing(category, listing._id);
                setAllListings((prev) => prev.filter((l) => l._id !== listing._id));
              } catch {
                showErrorToast(
                  "Error",
                  isDraft
                    ? "Failed to delete draft. Please try again."
                    : "Failed to delete listing. Please try again.",
                );
              }
            },
          },
        ],
      );
    },
    [],
  );

  const emptyState = useMemo(() => {
    if (activeTab === "Active") {
      return {
        icon: "inventory-2" as const,
        title: "No active listings",
        subtitle: "Post your first item to see it here",
        showSellCta: true,
      };
    }
    if (activeTab === "Expired") {
      return {
        icon: "history" as const,
        title: "No expired listings",
        subtitle: "Expired or sold listings will appear here",
        showSellCta: false,
      };
    }
    return {
      icon: "edit-note" as const,
      title: "No drafts",
      subtitle: "Saved drafts will appear here",
      showSellCta: true,
    };
  }, [activeTab]);

  return (
    <ProfileSubScreenLayout
      title="My listings"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={["#27BB97"]}
          tintColor="#27BB97"
        />
      }
    >
      <MyListingsTabs activeTab={activeTab} onTabPress={setActiveTab} />

      {loading && visibleListings.length === 0 ? (
        <View className="items-center py-16">
          <ActivityIndicator size="large" color="#27BB97" />
        </View>
      ) : null}

      {!loading && visibleListings.length === 0 ? (
        <View className="items-center rounded-2xl bg-white px-6 py-14">
          <MaterialIcons name={emptyState.icon} size={48} color="#D1D5DB" />
          <Text
            className="mt-3 text-[16px] text-[#1A1A1A]"
            style={{ fontFamily: ListifyFonts.semiBold }}
          >
            {emptyState.title}
          </Text>
          <Text
            className="mt-1 text-center text-[13px] text-[#9CA3AF]"
            style={{ fontFamily: ListifyFonts.regular }}
          >
            {emptyState.subtitle}
          </Text>
          {emptyState.showSellCta ? (
            <Pressable
              onPress={() => router.push("/sell-entry" as Href)}
              className="mt-5 rounded-full bg-[#27BB97] px-6 py-3"
            >
              <Text
                className="text-[14px] text-white"
                style={{ fontFamily: ListifyFonts.semiBold }}
              >
                {activeTab === "Drafts" ? "Create listing" : "Start selling"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {visibleListings.map((listing) => {
        const cat = getCategory(listing);

        if (activeTab === "Active") {
          return (
            <MyListingManageCard
              key={listing._id}
              listing={listing}
              statusLabel="Active"
              statusColor="#27BB97"
              metaLine={`${cat} · Posted ${formatTimeAgo(listing.createdAt) ?? "recently"}`}
              onPress={() => openDetail(listing)}
              onEdit={() => handleEditListing(listing)}
              onDelete={() => handleDeleteListing(listing, false)}
            />
          );
        }

        if (activeTab === "Expired") {
          const isSold = listing.status === "sold";
          const updatedAt =
            typeof listing.updatedAt === "string"
              ? listing.updatedAt
              : typeof listing.createdAt === "string"
                ? listing.createdAt
                : undefined;

          return (
            <MyListingManageCard
              key={listing._id}
              listing={listing}
              statusLabel={isSold ? "Sold" : "Expired"}
              statusColor={isSold ? "#6B7280" : "#EF4444"}
              metaLine={`${cat} · ${isSold ? "Sold" : "Expired"} ${formatTimeAgo(updatedAt) ?? "recently"}`}
              dimmed
              showActions={false}
              onPress={() => openDetail(listing)}
            />
          );
        }

        const updatedAt =
          typeof listing.updatedAt === "string"
            ? listing.updatedAt
            : typeof listing.createdAt === "string"
              ? listing.createdAt
              : undefined;

        return (
          <MyListingManageCard
            key={listing._id}
            listing={{ ...listing, title: listing.title || "Untitled draft" }}
            statusLabel="Draft"
            statusColor="#F59E0B"
            metaLine={`${cat ?? "Uncategorized"} · Edited ${formatTimeAgo(updatedAt) ?? "recently"}`}
            onPress={() => handleEditListing(listing)}
            onEdit={() => handleEditListing(listing)}
            onDelete={() => handleDeleteListing(listing, true)}
          />
        );
      })}
    </ProfileSubScreenLayout>
  );
}
