import type { ListingItem } from "@/features/listing/services/listing-api";

type ListingOwnerFields = {
  seller?: ListingItem["seller"];
  userId?: string;
  sellerId?: string;
};

/** Resolve listing owner id from API shapes (ObjectId string or populated seller). */
export function getListingSellerId(listing: ListingOwnerFields): string | null {
  if (listing.sellerId) {
    return String(listing.sellerId);
  }
  const seller = listing.seller;
  if (typeof seller === "string" && seller.trim()) {
    return seller.trim();
  }
  if (seller && typeof seller === "object" && "_id" in seller) {
    const id = (seller as { _id?: string })._id;
    return id ? String(id) : null;
  }
  if (listing.userId) {
    return String(listing.userId);
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
