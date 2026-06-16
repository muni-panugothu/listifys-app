/**
 * Loads a listing into the post-ad Redux form and opens step 2 (post-ad2 style).
 */
import { useLocalSearchParams, useRouter } from "@/lib/safe-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import type { CategorySlug } from "@/constants/categories";
import { fetchListingById } from "@/features/listing/services/listing-api";
import { mapListingToPostForm } from "@/lib/hydrate-post-form-from-listing";
import { showErrorToast } from "@/lib/toast";
import { useAppDispatch } from "@/store/hooks";
import { hydratePostForm } from "@/store/slices/post-form-slice";

export function EditListingScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const params = useLocalSearchParams<{ category?: string; id?: string }>();
  const categorySlug = (params.category ?? "electronics") as CategorySlug;
  const listingId = params.id;
  const startedRef = useRef(false);

  useEffect(() => {
    if (!listingId || startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        const res = await fetchListingById(categorySlug, listingId);
        if (!res.listing) {
          showErrorToast("Not found", "This listing could not be loaded.");
          router.back();
          return;
        }

        dispatch(hydratePostForm(mapListingToPostForm(res.listing, categorySlug)));
        router.replace("/post-ad-step2-details");
      } catch {
        showErrorToast("Error", "Failed to load listing data.");
        router.back();
      }
    })();
  }, [categorySlug, dispatch, listingId, router]);

  return (
    <View className="flex-1 items-center justify-center bg-[#F6F7F8]">
      <ActivityIndicator size="large" color="#27BB97" />
      <Text className="mt-3 text-[14px] text-[#6C7A74]">Loading listing...</Text>
    </View>
  );
}
