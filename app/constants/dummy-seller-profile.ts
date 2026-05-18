import {
  DUMMY_TRENDING_LISTINGS,
  type DummyTrendingListing,
} from "@/constants/dummy-trending-listings";

export type DummySellerReview = {
  id: string;
  name: string;
  avatar: string;
  date: string;
  rating: number;
  review: string;
};

const REVIEW_SNIPPETS = [
  "Fast response and item exactly as described. Would buy again!",
  "Great communication and smooth pickup. Highly recommend this seller.",
  "Honest about condition and fair pricing. Very professional.",
  "Packaged well and met on time. Trustworthy seller on Listify.",
];

function hashName(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) {
    h = (h << 5) - h + name.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function getDummySellerListings(sellerName: string): DummyTrendingListing[] {
  return DUMMY_TRENDING_LISTINGS.filter(
    (item) => item.sellerName?.toLowerCase() === sellerName.toLowerCase(),
  );
}

export function getDummySellerStats(sellerName: string) {
  const listings = getDummySellerListings(sellerName);
  const seed = hashName(sellerName);
  return {
    listingsCount: listings.length || 3,
    followersCount: 40 + (seed % 320),
    followingCount: 8 + (seed % 45),
    avgRating:
      listings.length > 0
        ? listings.reduce((sum, l) => sum + (l.sellerRating ?? 4.8), 0) /
          listings.length
        : 4.8,
    ratingsCount: 12 + (seed % 186),
  };
}

export function getDummySellerReviews(sellerName: string): DummySellerReview[] {
  const seed = hashName(sellerName);
  const buyers = ["Rahul M.", "Ananya I.", "Vikram S.", "Sneha K."];
  return buyers.slice(0, 3).map((name, index) => ({
    id: `${sellerName}-review-${index}`,
    name,
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=27BB97&color=fff&size=128`,
    date: index === 0 ? "2 days ago" : index === 1 ? "1 week ago" : "2 weeks ago",
    rating: Math.min(5, 4 + ((seed + index) % 2)),
    review: REVIEW_SNIPPETS[(seed + index) % REVIEW_SNIPPETS.length],
  }));
}

export function isDummySellerId(sellerId: string) {
  return !sellerId || sellerId === "dummy-seller";
}
