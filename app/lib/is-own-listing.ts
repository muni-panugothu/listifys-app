import type { ListingItem } from "@/features/listing/services/listing-api";

type ListingOwnerFields = {
  seller?: ListingItem["seller"];
  userId?: string | { _id?: string; id?: string };
  sellerId?: string;
};

/** Resolve listing owner id from API shapes (ObjectId string, populated seller, or populated userId). */
export function getListingSellerId(listing: ListingOwnerFields): string | null {
  if (listing.sellerId) {
    return String(listing.sellerId);
  }

  const seller = listing.seller;
  if (typeof seller === "string" && seller.trim()) {
    return seller.trim();
  }
  if (seller && typeof seller === "object") {
    const id = (seller as { _id?: string; id?: string })._id ?? (seller as { _id?: string; id?: string }).id;
    if (id) return String(id);
  }

  const userId = listing.userId;
  if (typeof userId === "string" && userId.trim()) {
    return userId.trim();
  }
  if (userId && typeof userId === "object") {
    const id = userId._id ?? userId.id;
    if (id) return String(id);
  }

  return null;
}

export function isOwnListing(
  listing: ListingOwnerFields | null | undefined,
  userId?: string | null,
): boolean {
  if (!userId || !listing) return false;
  const sellerId = getListingSellerId(listing);
  return sellerId != null && sellerId === String(userId);
}

export function filterOutOwnListings<T extends ListingOwnerFields>(
  listings: T[],
  userId?: string | null,
): T[] {
  if (!userId) return listings;
  return listings.filter((item) => !isOwnListing(item, userId));
}
