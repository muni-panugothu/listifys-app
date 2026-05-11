/**
 * EditListingScreen — loads listing data from the API and allows
 * editing title, price, description, condition. Handles update + delete
 * with actual API calls (including S3 image cleanup on delete).
 */
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "@/lib/safe-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { CategorySlug } from "@/constants/categories";
import {
  deleteListing,
  fetchListingById,
  updateListing,
  type ListingItem,
} from "@/features/listing/services/listing-api";
import { Image } from "@/lib/nativewind-interop";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IMAGE_GAP = 12;
const SIDE_IMAGE_SIZE = (SCREEN_WIDTH - 32 - IMAGE_GAP * 2) / 3;

const CONDITIONS = ["New", "Like New", "Good", "Fair", "For Parts"];

export function EditListingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string; id?: string }>();
  const categorySlug = (params.category ?? "electronics") as CategorySlug;
  const listingId = params.id;

  const [listing, setListing] = useState<ListingItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Editable fields
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [condition, setCondition] = useState("");
  const [location, setLocation] = useState("");

  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);

  // Load listing data
  useEffect(() => {
    if (!listingId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetchListingById(categorySlug, listingId);
        if (res.listing) {
          setListing(res.listing);
          setTitle(res.listing.title || "");
          setPrice(res.listing.price ? String(res.listing.price) : "");
          setDescription(res.listing.description || "");
          setCondition(res.listing.condition || "");
          setLocation(res.listing.location || "");
        }
      } catch {
        Alert.alert("Error", "Failed to load listing data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [categorySlug, listingId]);

  const handleSave = useCallback(async () => {
    if (!listingId || !title.trim()) {
      Alert.alert("Validation", "Title is required.");
      return;
    }
    setSaving(true);
    try {
      await updateListing(categorySlug, listingId, {
        title: title.trim(),
        price: price ? Number(price) : undefined,
        description: description.trim(),
        condition: condition || undefined,
        location: location.trim() || undefined,
      });
      Alert.alert("Updated", "Your listing has been updated successfully.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to update listing.");
    } finally {
      setSaving(false);
    }
  }, [categorySlug, listingId, title, price, description, condition, location, router]);

  const handleDelete = useCallback(() => {
    if (!listingId) return;
    Alert.alert(
      "Delete Listing",
      "This will permanently delete the listing and all associated images from storage. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteListing(categorySlug, listingId);
              Alert.alert("Deleted", "Listing removed successfully.", [
                { text: "OK", onPress: () => router.back() },
              ]);
            } catch {
              Alert.alert("Error", "Failed to delete listing.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }, [categorySlug, listingId, router]);

  const images = listing?.images || [];

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F4FBF6]">
        <ActivityIndicator size="large" color="#27BB97" />
        <Text className="mt-3 text-[14px] text-[#6C7A74]">Loading listing...</Text>
      </View>
    );
  }

  if (!listing) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F4FBF6]">
        <MaterialIcons name="error-outline" size={48} color="#94A3B8" />
        <Text className="mt-3 text-[16px] font-semibold text-[#6C7A74]">Listing not found</Text>
        <Pressable onPress={() => router.back()} className="mt-4 rounded-lg bg-[#27BB97] px-6 py-2.5">
          <Text className="text-[14px] font-semibold text-white">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      {/* Top Bar */}
      <View
        className="absolute inset-x-0 top-0 z-50 flex-row items-center justify-between border-b border-[#DDE4DF] bg-white/90 px-4"
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
            <MaterialIcons name="arrow-back" size={23} color="#161D1A" />
          </Pressable>
          <Text className="text-[20px] font-semibold text-[#161D1A]">
            Edit Listing
          </Text>
        </View>
        <Pressable
          onPress={handleDelete}
          disabled={deleting}
          className="flex-row items-center gap-1.5 rounded-lg px-3 py-1.5"
          style={({ pressed }) => ({ opacity: pressed || deleting ? 0.5 : 1 })}
        >
          {deleting ? (
            <ActivityIndicator size="small" color="#BA1A1A" />
          ) : (
            <>
              <MaterialIcons name="delete" size={20} color="#BA1A1A" />
              <Text className="text-[12px] font-medium text-[#BA1A1A]">Delete</Text>
            </>
          )}
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: topBarHeight + 16,
          paddingBottom: 100 + Math.max(insets.bottom, 8),
        }}
      >
        <View className="px-4">
          {/* Photos Section */}
          {images.length > 0 && (
            <View className="mb-6">
              <Text className="mb-4 text-[18px] font-semibold text-[#161D1A]">
                Photos
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {images.map((img, idx) => (
                  <View
                    key={img + idx}
                    className="overflow-hidden rounded-xl border border-[#DDE4DF]"
                    style={{ width: SIDE_IMAGE_SIZE * 1.5, height: SIDE_IMAGE_SIZE * 1.5 }}
                  >
                    <Image source={img} contentFit="cover" className="h-full w-full" />
                    {idx === 0 && (
                      <View className="absolute left-2 top-2 rounded-full bg-white/80 px-2 py-0.5">
                        <Text className="text-[10px] font-bold text-[#004535]">COVER</Text>
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Pricing Section */}
          <View className="mb-6 rounded-2xl border border-[#DDE4DF] bg-white p-5">
            <Text className="text-[18px] font-semibold text-[#161D1A]">Pricing</Text>
            <Text className="mb-4 text-[14px] text-[#6C7A74]">Set a competitive price to sell faster.</Text>
            <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">Selling Price</Text>
            <View className="mb-4 h-12 flex-row items-center rounded-lg border border-[#BBCAC3] bg-[#EFF5F0] px-4">
              <Text className="mr-2 text-[20px] font-bold text-[#3C4A44]">₹</Text>
              <TextInput
                value={price}
                onChangeText={(v) => setPrice(v.replace(/[^0-9]/g, ""))}
                keyboardType="numeric"
                className="flex-1 text-[20px] font-bold text-[#161D1A]"
                style={{ paddingVertical: 0 }}
              />
            </View>
          </View>

          {/* Details Section */}
          <View className="mb-6">
            <Text className="mb-4 px-1 text-[18px] font-semibold text-[#161D1A]">Details</Text>
            <View className="mb-4">
              <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">Title</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                className="rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[16px] text-[#161D1A]"
              />
            </View>
            <View className="mb-4">
              <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">Category</Text>
              <View className="h-12 flex-row items-center justify-between rounded-lg border border-[#BBCAC3] bg-slate-50 px-4">
                <Text className="text-[16px] text-[#6C7A74]">{categorySlug}</Text>
                <MaterialIcons name="lock" size={18} color="#94A3B8" />
              </View>
            </View>
            <View>
              <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                className="min-h-[120px] rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[16px] text-[#161D1A]"
              />
            </View>
          </View>

          {/* Condition */}
          <View className="mb-6">
            <Text className="mb-3 px-1 text-[18px] font-semibold text-[#161D1A]">Condition</Text>
            <View className="flex-row flex-wrap gap-2">
              {CONDITIONS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setCondition(c)}
                  className="rounded-full px-4 py-2"
                  style={{
                    borderWidth: 1.5,
                    borderColor: condition === c ? "#27BB97" : "#E2E8F0",
                    backgroundColor: condition === c ? "rgba(39,187,151,0.1)" : "#FFFFFF",
                  }}
                >
                  <Text
                    className="text-[13px] font-medium"
                    style={{ color: condition === c ? "#006B55" : "#3C4A44" }}
                  >
                    {c}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Location */}
          <View className="mb-6">
            <Text className="mb-3 px-1 text-[18px] font-semibold text-[#161D1A]">Location</Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Enter location"
              placeholderTextColor="#94A3B8"
              className="rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[16px] text-[#161D1A]"
            />
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View
        className="absolute inset-x-0 bottom-0 z-50 flex-row gap-3 border-t border-[#DDE4DF] bg-white/95 px-4 py-4"
        style={{ paddingBottom: Math.max(insets.bottom, 8) }}
      >
        <Pressable
          onPress={() => router.back()}
          className="flex-1 items-center justify-center rounded-xl bg-[#E3EAE5] py-4"
          style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
        >
          <Text className="text-[14px] font-medium text-[#161D1A]">Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          className="flex-[2] overflow-hidden rounded-xl"
          style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }], opacity: saving ? 0.7 : 1 })}
        >
          <LinearGradient
            colors={["#27BB97", "#1E9E7E"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{
              paddingVertical: 16,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8,
            }}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-[18px] font-semibold text-white">Update Listing</Text>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}
