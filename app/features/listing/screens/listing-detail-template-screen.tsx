import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useLocalSearchParams, useRouter } from "@/lib/safe-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Keyboard,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { CategorySlug } from "@/constants/categories";
import { AUTH_API_BASE_URL, requestJson } from "@/features/auth/services/auth-api";
import {
  addToRecentlyViewed,
  fetchListingById,
  toggleSaveListing,
  type ListingItem,
} from "@/features/listing/services/listing-api";
import { AuthGateBottomSheet } from "@/features/auth/components/auth-gate-bottom-sheet";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { Image } from "@/lib/nativewind-interop";
import { useAppSelector } from "@/store/hooks";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export function ListingDetailTemplateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string; id?: string }>();
  const user = useAppSelector((s) => s.auth.user);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [listing, setListing] = useState<ListingItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  const categorySlug = (params.category ?? "electronics") as CategorySlug;
  const listingId = params.id;

  // Auth gate for guest users
  const [authGateVisible, setAuthGateVisible] = useState(false);
  const [authGateAction, setAuthGateAction] = useState<"save" | "message" | "offer">("general" as any);

  const requireAuth = useCallback((action: "save" | "message" | "offer", callback: () => void) => {
    if (!user) {
      setAuthGateAction(action);
      setAuthGateVisible(true);
      return;
    }
    callback();
  }, [user]);

  const loadListing = useCallback(async () => {
    if (!listingId) return;
    setLoading(true);
    try {
      const res = await fetchListingById(categorySlug, listingId);
      if (res.listing) {
        setListing(res.listing);
        // Track recently viewed
        addToRecentlyViewed(res.listing).catch(() => {});
        // Check if user has saved this listing
        if (user?.id && res.listing.savedBy?.includes(user.id)) {
          setIsSaved(true);
        }
      }
    } catch {
      // keep null
    } finally {
      setLoading(false);
    }
  }, [categorySlug, listingId, user?.id]);

  useEffect(() => {
    loadListing();
  }, [loadListing]);

  const { refreshing, onRefresh } = usePullToRefresh(loadListing);

  const handleToggleSave = useCallback(async () => {
    if (!listingId) return;
    requireAuth("save", async () => {
      try {
        const res = await toggleSaveListing(categorySlug, listingId);
        setIsSaved(res.saved);
      } catch { /* silently fail */ }
    });
  }, [categorySlug, listingId, requireAuth]);

  const images = listing?.images?.length ? listing.images : [];
  const title = listing?.title ?? "";
  const price = listing?.price
    ? `₹${Number(listing.price).toLocaleString("en-IN")}`
    : "";
  const condition = listing?.condition ?? "";
  const description = listing?.description ?? "";
  const locationText = listing?.location ?? "";

  // Seller info from API
  const sellerName = listing?.seller?.name ?? listing?.sellerName ?? "Seller";
  const sellerProfileImage = listing?.seller?.profileImage
    ? (listing.seller.profileImage.startsWith("http")
        ? listing.seller.profileImage
        : `${AUTH_API_BASE_URL}${listing.seller.profileImage}`)
    : null;
  const sellerJoined = listing?.seller?.createdAt
    ? `Member since ${new Date(listing.seller.createdAt).getFullYear()}`
    : listing?.createdAt
      ? `Member since ${new Date(listing.createdAt).getFullYear()}`
      : "";

  const footerInsetPadding = Math.max(insets.bottom, 12);
  const topControlsOffset = useMemo(() => insets.top + 8, [insets.top]);

  // ── Make Offer Bottom Sheet ───────────────────────────────────────────
  const [offerVisible, setOfferVisible] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [selectedChip, setSelectedChip] = useState("");
  const [sendingOffer, setSendingOffer] = useState(false);
  const [offerSent, setOfferSent] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const recommendedOffers = useMemo(() => {
    if (!listing?.price) return [];
    const p = Number(listing.price);
    return [
      Math.round(p * 0.85 / 100) * 100,
      Math.round(p * 0.90 / 100) * 100,
      Math.round(p * 0.95 / 100) * 100,
    ];
  }, [listing?.price]);

  const openOfferSheet = useCallback(() => {
    if (listing?.price) {
      const defaultOffer = Math.round(Number(listing.price) * 0.90 / 100) * 100;
      setOfferAmount(String(defaultOffer));
      setSelectedChip(String(defaultOffer));
    }
    setOfferSent(false);
    setOfferVisible(true);
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [listing?.price, slideAnim]);

  const closeOfferSheet = useCallback(() => {
    Keyboard.dismiss();
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setOfferVisible(false));
  }, [slideAnim]);

  const handleSendOffer = useCallback(async () => {
    if (!listing || !offerAmount || sendingOffer) return;
    const sellerId = listing.seller?._id;
    if (!sellerId) return;
    setSendingOffer(true);
    try {
      await requestJson("/api/chat/make-offer", {
        method: "POST",
        body: JSON.stringify({
          recipientId: sellerId,
          listingId: listing._id,
          listingType: categorySlug,
          listingTitle: listing.title,
          offerAmount: Number(offerAmount),
          listingPrice: listing.price,
          productImage: listing.images?.[0] ?? null,
        }),
      });
      setOfferSent(true);
      setTimeout(() => closeOfferSheet(), 1800);
    } catch {
      // silently fail
    } finally {
      setSendingOffer(false);
    }
  }, [listing, offerAmount, sendingOffer, categorySlug, closeOfferSheet]);

  // ── Category-specific detail rows ─────────────────────────────────────
  const detailRows = useMemo(() => {
    if (!listing) return [];
    const rows: { label: string; value: string; icon: React.ComponentProps<typeof MaterialIcons>["name"] }[] = [];
    if (listing.brand) rows.push({ label: "Brand", value: listing.brand, icon: "label" });
    if (listing.model) rows.push({ label: "Model", value: listing.model, icon: "smartphone" });
    if (listing.warranty) rows.push({ label: "Warranty", value: listing.warranty, icon: "verified-user" });
    if (listing.ram) rows.push({ label: "RAM", value: listing.ram, icon: "memory" });
    if (listing.storage) rows.push({ label: "Storage", value: listing.storage, icon: "sd-storage" });
    if (listing.color) rows.push({ label: "Color", value: listing.color, icon: "palette" });
    if (listing.year) rows.push({ label: "Year", value: String(listing.year), icon: "calendar-today" });
    if (listing.mileage) rows.push({ label: "Mileage", value: listing.mileage, icon: "speed" });
    if (listing.fuelType) rows.push({ label: "Fuel Type", value: listing.fuelType, icon: "local-gas-station" });
    if (listing.transmission) rows.push({ label: "Transmission", value: listing.transmission, icon: "settings" });
    if (listing.bedrooms) rows.push({ label: "Bedrooms", value: String(listing.bedrooms), icon: "king-bed" });
    if (listing.bathrooms) rows.push({ label: "Bathrooms", value: String(listing.bathrooms), icon: "bathtub" });
    if (listing.area) rows.push({ label: "Area", value: listing.area, icon: "square-foot" });
    if (listing.propertyType) rows.push({ label: "Type", value: listing.propertyType, icon: "apartment" });
    if (listing.furnished) rows.push({ label: "Furnished", value: listing.furnished, icon: "weekend" });
    // Event-specific fields
    const l = listing as any;
    if (l.eventDate) rows.push({ label: "Event Date", value: l.eventDate, icon: "calendar-today" });
    if (l.eventTime) rows.push({ label: "Event Time", value: l.eventTime, icon: "schedule" });
    if (l.venue) rows.push({ label: "Venue", value: l.venue, icon: "place" });
    if (l.organizer) rows.push({ label: "Organizer", value: l.organizer, icon: "person" });
    if (l.ticketsAvailable) rows.push({ label: "Tickets", value: String(l.ticketsAvailable), icon: "confirmation-number" });
    if (l.ageRestriction) rows.push({ label: "Age Restriction", value: l.ageRestriction, icon: "person" });
    if (l.dressCode) rows.push({ label: "Dress Code", value: l.dressCode, icon: "checkroom" });
    // Job-specific fields
    if (l.companyName) rows.push({ label: "Company", value: l.companyName, icon: "business" });
    if (l.jobType) rows.push({ label: "Job Type", value: l.jobType, icon: "work" });
    if (l.workMode) rows.push({ label: "Work Mode", value: l.workMode, icon: "wifi" });
    if (l.experience) rows.push({ label: "Experience", value: l.experience, icon: "trending-up" });
    if (l.education) rows.push({ label: "Education", value: l.education, icon: "school" });
    if (l.industry) rows.push({ label: "Industry", value: l.industry, icon: "domain" });
    if (l.department) rows.push({ label: "Department", value: l.department, icon: "group-work" });
    if (l.employmentType) rows.push({ label: "Employment", value: l.employmentType, icon: "assignment-ind" });
    if (l.positions && l.positions > 1) rows.push({ label: "Positions", value: String(l.positions), icon: "people" });
    if (l.salary?.min && l.salary?.max) {
      const fmt = (n: number) => {
        if (n >= 100000) return `${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L`;
        if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
        return n.toLocaleString("en-IN");
      };
      const cur = listing.currency ?? "\u20B9";
      rows.push({ label: "Salary", value: `${cur}${fmt(l.salary.min)} - ${cur}${fmt(l.salary.max)}`, icon: "payments" });
    }
    if (l.salaryType) rows.push({ label: "Salary Type", value: l.salaryType, icon: "schedule" });
    if (listing.subcategory) rows.push({ label: "Category", value: listing.subcategory, icon: "category" });
    return rows;
  }, [listing]);

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      {/* Loading state */}
      {loading && !listing && (
        <View className="absolute inset-0 z-40 items-center justify-center bg-[#F4FBF6]">
          <ActivityIndicator size="large" color="#27BB97" />
        </View>
      )}

      <View
        className="absolute inset-x-0 z-50 flex-row items-center justify-between px-4"
        style={{ top: topControlsOffset }}
      >
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-white/70"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.08,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <MaterialIcons name="arrow-back" size={22} color="#161D1A" />
        </Pressable>

        <View className="flex-row gap-2">
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full bg-white/70"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.08,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <MaterialIcons name="share" size={21} color="#161D1A" />
          </Pressable>
          <Pressable
            onPress={handleToggleSave}
            className="h-10 w-10 items-center justify-center rounded-full bg-white/70"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.08,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <MaterialIcons
              name={isSaved ? "favorite" : "favorite-border"}
              size={21}
              color={isSaved ? "#EF4444" : "#161D1A"}
            />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#27BB97"]}
            tintColor="#27BB97"
            progressViewOffset={topControlsOffset}
          />
        }
        contentContainerStyle={{ paddingBottom: 96 + footerInsetPadding }}
      >
        <View className="relative h-105 w-full overflow-hidden bg-[#E9EFEB]">
          {images.length === 0 ? (
            <View className="h-full w-full items-center justify-center">
              <MaterialIcons name="image" size={64} color="#CBD5E1" />
              <Text className="mt-2 text-[14px] text-[#94A3B8]">No images</Text>
            </View>
          ) : (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const x = event.nativeEvent.contentOffset.x;
              const index = Math.round(x / SCREEN_WIDTH);
              setActiveImageIndex(index);
            }}
          >
            {images.map((image, index) => (
              <View
                key={image + index.toString()}
                style={{ width: SCREEN_WIDTH, height: 420 }}
              >
                <Image
                  source={image}
                  contentFit="cover"
                  transition={200}
                  className="h-full w-full"
                />
              </View>
            ))}
          </ScrollView>
          )}

          {images.length > 0 && (
          <View className="absolute bottom-4 left-0 right-0 flex-row justify-center gap-2">
            {images.map((_, index) => (
              <View
                key={index.toString()}
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor:
                    index === activeImageIndex
                      ? "#FFFFFF"
                      : "rgba(255,255,255,0.45)",
                }}
              />
            ))}
          </View>
          )}
        </View>

        <View className="mt-4 gap-4 px-4">
          <View className="gap-2">
            <Text className="text-[24px] font-bold leading-8 text-[#161D1A]">
              {title}
            </Text>
            <View className="flex-row items-center gap-2">
              <Text className="text-[20px] font-bold text-[#27BB97]">
                {price}
              </Text>
              <View className="rounded-full bg-[#27BB97]/10 px-2.5 py-0.5">
                <Text className="text-[12px] font-medium text-[#27BB97]">
                  {condition}
                </Text>
              </View>
            </View>
          </View>

          <View className="pt-1">
            <Text className="mb-2 text-[18px] font-semibold text-[#161D1A]">
              Description
            </Text>
            <Text className="text-[14px] leading-6 text-[#3C4A44]">
              {description}
            </Text>
          </View>

          {detailRows.length > 0 && (
            <>
              <View className="h-px bg-[#BBCAC3]/30" />
              <View className="py-1">
                <Text className="mb-3 text-[18px] font-semibold text-[#161D1A]">
                  Details
                </Text>
                <View className="rounded-xl border border-[#BBCAC3]/20 bg-white overflow-hidden">
                  {detailRows.map((row, idx) => (
                    <View
                      key={row.label}
                      className="flex-row items-center px-4 py-3"
                      style={idx < detailRows.length - 1 ? { borderBottomWidth: 1, borderBottomColor: "rgba(187,202,195,0.15)" } : undefined}
                    >
                      <View className="mr-3 h-8 w-8 items-center justify-center rounded-lg bg-[#27BB97]/10">
                        <MaterialIcons name={row.icon} size={16} color="#27BB97" />
                      </View>
                      <Text className="flex-1 text-[14px] text-[#6C7A74]">{row.label}</Text>
                      <Text className="text-[14px] font-medium text-[#161D1A]">{row.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          )}

          <View className="h-px bg-[#BBCAC3]/30" />

          <View className="py-1">
            <Text className="mb-3 text-[18px] font-semibold text-[#161D1A]">
              Location
            </Text>
            <View className="relative h-40 w-full overflow-hidden rounded-xl border border-[#BBCAC3]/30">
              <View className="h-full w-full bg-[#E6F4EF]" />
              <View className="absolute inset-0 items-center justify-center">
                <View className="h-24 w-24 items-center justify-center rounded-full border-2 border-[#27BB97]/40 bg-[#27BB97]/10">
                  <View className="h-4 w-4 rounded-full bg-[#27BB97]" />
                </View>
              </View>
            </View>
            <View className="mt-2 flex-row items-center gap-2">
              <MaterialIcons name="location-on" size={18} color="#3C4A44" />
              <Text className="text-[12px] font-medium text-[#3C4A44]">
                {locationText}
              </Text>
            </View>
          </View>

          <View className="h-px bg-[#BBCAC3]/30" />

          <View className="py-1">
            <Text className="mb-4 text-[18px] font-semibold text-[#161D1A]">
              Seller Information
            </Text>
            <Pressable
              onPress={() => {
                if (listing?.seller?._id) {
                  router.push(`/seller-public-profile?sellerId=${listing.seller._id}` as any);
                }
              }}
              className="flex-row items-center rounded-xl border border-[#BBCAC3]/20 bg-white p-4"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 3,
                elevation: 1,
              }}
            >
              <View className="mr-4 h-14 w-14 overflow-hidden rounded-full border-2 border-white">
                {sellerProfileImage ? (
                  <Image
                    source={sellerProfileImage}
                    contentFit="cover"
                    transition={200}
                    className="h-full w-full"
                  />
                ) : (
                  <View className="h-full w-full items-center justify-center bg-[#27BB97]">
                    <Text className="text-[20px] font-bold text-white">
                      {sellerName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>

              <View className="flex-1">
                <View className="flex-row items-center gap-1">
                  <Text className="text-[20px] font-semibold text-[#161D1A]">
                    {sellerName}
                  </Text>
                  <MaterialIcons name="verified" size={18} color="#005FB0" />
                </View>
                {sellerJoined ? (
                  <Text className="text-[12px] text-[#3C4A44]">
                    {sellerJoined}
                  </Text>
                ) : null}
                {listing?.views ? (
                  <View className="mt-1 flex-row items-center gap-1">
                    <MaterialIcons name="visibility" size={16} color="#64748B" />
                    <Text className="text-[12px] text-[#3C4A44]">
                      {listing.views} views
                    </Text>
                  </View>
                ) : null}
              </View>

              <MaterialIcons name="chevron-right" size={22} color="#161D1A" />
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <View
        className="absolute inset-x-0 bottom-0 z-50 border-t border-[#BBCAC3]/20 bg-white/95 px-4"
        style={{ paddingTop: 12, paddingBottom: footerInsetPadding }}
      >
        <View className="flex-row gap-4">
          <Pressable
            onPress={() => {
              const sellerId = listing?.seller?._id;
              if (!sellerId) return;
              requireAuth("message", () => {
                router.push(
                  `/chat-conversation?recipientId=${sellerId}&listingId=${listing._id}&listingType=${categorySlug}&listingTitle=${encodeURIComponent(title)}&listingPrice=${listing.price ?? ""}&listingImage=${encodeURIComponent(listing.images?.[0] ?? "")}&currency=${encodeURIComponent(listing.currency ?? "₹")}` as Href,
                );
              });
            }}
            className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl border-2 border-[#BBCAC3]/50 bg-white"
          >
            <MaterialIcons name="chat" size={20} color="#161D1A" />
            <Text className="text-[16px] font-semibold text-[#161D1A]">
              Message
            </Text>
          </Pressable>
          <Pressable
            onPress={() => requireAuth("offer", openOfferSheet)}
            className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-[#27BB97]"
            style={{
              shadowColor: "#27BB97",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            <MaterialIcons name="local-offer" size={20} color="#FFFFFF" />
            <Text className="text-[16px] font-semibold text-white">Make Offer</Text>
          </Pressable>
        </View>
      </View>

      {/* Make Offer Bottom Sheet */}
      <Modal
        visible={offerVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeOfferSheet}
      >
        <Pressable onPress={closeOfferSheet} className="flex-1 bg-black/40">
          <View style={{ flex: 1, minHeight: 80 }} />
        </Pressable>
        <Animated.View
          style={{
            transform: [{
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [600, 0],
              }),
            }],
          }}
        >
          <View
            className="rounded-t-3xl border-t border-slate-100 bg-white"
            style={{
              paddingBottom: Math.max(insets.bottom, 16),
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -12 },
              shadowOpacity: 0.15,
              shadowRadius: 40,
              elevation: 24,
            }}
          >
            {/* Handle */}
            <View className="items-center py-3">
              <View className="h-1.5 w-12 rounded-full bg-slate-200" />
            </View>

            <View className="px-4 pb-4">
              {offerSent ? (
                <View className="items-center py-8">
                  <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-[#27BB97]/15">
                    <MaterialIcons name="check-circle" size={40} color="#27BB97" />
                  </View>
                  <Text className="text-[20px] font-bold text-[#161D1A]">
                    Offer Sent!
                  </Text>
                  <Text className="mt-1 text-center text-[14px] text-[#6C7A74]">
                    The seller will be notified and can accept or counter.
                  </Text>
                </View>
              ) : (
                <>
                  {/* Header */}
                  <View className="mb-5 flex-row items-center justify-between">
                    <Text className="text-[24px] font-bold tracking-tight text-[#161D1A]">
                      Make an Offer
                    </Text>
                    <Pressable
                      onPress={closeOfferSheet}
                      className="rounded-full p-2"
                      style={({ pressed }) => ({
                        backgroundColor: pressed ? "#F1F5F9" : "transparent",
                      })}
                    >
                      <MaterialIcons name="close" size={24} color="#94A3B8" />
                    </Pressable>
                  </View>

                  {/* Product Summary */}
                  <View className="mb-5 flex-row items-center gap-3 rounded-xl bg-[#EFF5F0] p-3">
                    {images[0] ? (
                      <Image
                        source={images[0]}
                        contentFit="cover"
                        className="h-14 w-14 rounded-lg"
                      />
                    ) : (
                      <View className="h-14 w-14 items-center justify-center rounded-lg bg-slate-200">
                        <MaterialIcons name="image" size={24} color="#CBD5E1" />
                      </View>
                    )}
                    <View className="flex-1">
                      <Text className="text-[13px] font-medium text-[#161D1A]" numberOfLines={1}>
                        {title}
                      </Text>
                      <Text className="mt-0.5 text-[12px] font-medium uppercase text-[#6C7A74]">
                        Listed Price
                      </Text>
                      <Text className="text-[16px] font-bold text-[#161D1A]">
                        {price}
                      </Text>
                    </View>
                  </View>

                  {/* Recommended Offers */}
                  {recommendedOffers.length > 0 && (
                    <View className="mb-6">
                      <Text className="mb-3 text-[12px] font-medium uppercase tracking-wide text-[#6C7A74]">
                        Recommended Offers
                      </Text>
                      <View className="flex-row flex-wrap gap-2">
                        {recommendedOffers.map((amt) => {
                          const label = `₹${amt.toLocaleString("en-IN")}`;
                          const isSelected = selectedChip === String(amt);
                          return (
                            <Pressable
                              key={amt}
                              onPress={() => {
                                setSelectedChip(String(amt));
                                setOfferAmount(String(amt));
                              }}
                              className="rounded-full px-4 py-2.5"
                              style={{
                                borderWidth: 1.5,
                                borderColor: isSelected ? "#006B55" : "#E2E8F0",
                                backgroundColor: isSelected ? "rgba(39,187,151,0.1)" : "#FFFFFF",
                              }}
                            >
                              <Text
                                className="text-[14px] font-medium"
                                style={{ color: isSelected ? "#006B55" : "#161D1A" }}
                              >
                                {label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* Custom Input */}
                  <View className="mb-6">
                    <Text className="mb-2 text-[12px] font-medium uppercase tracking-wide text-[#161D1A]">
                      Your Offer
                    </Text>
                    <View className="h-14 flex-row items-center rounded-xl border-2 border-slate-100 bg-slate-50 px-4">
                      <Text className="text-[20px] font-bold text-slate-400">₹</Text>
                      <TextInput
                        value={offerAmount}
                        onChangeText={(val) => {
                          setOfferAmount(val.replace(/[^0-9]/g, ""));
                          setSelectedChip("");
                        }}
                        keyboardType="numeric"
                        placeholder="Enter amount"
                        placeholderTextColor="#CBD5E1"
                        className="ml-2 flex-1 text-[20px] font-bold text-[#161D1A]"
                        style={{ paddingVertical: 0 }}
                      />
                    </View>
                    <View className="mt-2 flex-row items-center gap-1">
                      <MaterialIcons name="info-outline" size={14} color="#6C7A74" />
                      <Text className="text-[12px] text-[#6C7A74]">
                        Offers are usually 5-15% below listed price
                      </Text>
                    </View>
                  </View>

                  {/* Submit */}
                  <Pressable
                    onPress={handleSendOffer}
                    disabled={sendingOffer || !offerAmount}
                    className="overflow-hidden rounded-xl"
                    style={({ pressed }) => ({
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                      opacity: !offerAmount ? 0.5 : 1,
                    })}
                  >
                    <LinearGradient
                      colors={["#27BB97", "#1E9E7E"]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={{
                        height: 56,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      }}
                    >
                      {sendingOffer ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Text className="text-[18px] font-semibold text-white">
                            Send Offer
                          </Text>
                          <MaterialIcons name="send" size={20} color="#FFFFFF" />
                        </>
                      )}
                    </LinearGradient>
                  </Pressable>
                  <Text className="mt-3 text-center text-[12px] text-slate-400">
                    The seller will be notified and can accept or counter.
                  </Text>
                </>
              )}
            </View>
          </View>
        </Animated.View>
      </Modal>

      {/* Auth Gate for guest users */}
      <AuthGateBottomSheet
        visible={authGateVisible}
        onClose={() => setAuthGateVisible(false)}
        action={authGateAction}
      />
    </View>
  );
}
