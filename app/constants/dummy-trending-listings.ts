export type DummyTrendingListing = {
  id: string;
  title: string;
  price: number;
  image: string;
  category: string;
  description?: string;
  condition?: string;
  sellerName?: string;
  sellerRating?: number;
};

export const DUMMY_TRENDING_LISTINGS: DummyTrendingListing[] = [
  {
    id: "dummy-1",
    title: "Sony WH-1000XM5 Headphones",
    price: 24999,
    image:
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=800&fit=crop&q=80",
    category: "electronics",
    condition: "Like New",
    sellerName: "Priya Sharma",
    sellerRating: 4.9,
    description:
      "Premium noise-cancelling headphones in excellent condition. Includes original case, USB-C cable, and 3.5mm adapter. Used for only 2 months.",
  },
  {
    id: "dummy-2",
    title: "MacBook Air M2 — Like New",
    price: 78999,
    image:
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&h=800&fit=crop&q=80",
    category: "electronics",
    condition: "Like New",
    sellerName: "Arjun Mehta",
    sellerRating: 4.8,
    description:
      "MacBook Air M2 8GB/256GB, battery health 96%. No scratches, always used with a case. Bill and box available.",
  },
  {
    id: "dummy-3",
    title: "Modern L-Shaped Sofa",
    price: 18500,
    image:
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=800&fit=crop&q=80",
    category: "furniture",
    condition: "Good",
    sellerName: "Sneha Reddy",
    sellerRating: 4.7,
    description:
      "Comfortable L-shaped sofa in grey fabric. Pet-free, smoke-free home. Buyer arranges pickup from Koramangala.",
  },
  {
    id: "dummy-4",
    title: "iPhone 14 Pro 256GB",
    price: 64999,
    image:
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&h=800&fit=crop&q=80",
    category: "mobiles",
    condition: "Good",
    sellerName: "Vikram Singh",
    sellerRating: 4.9,
    description:
      "iPhone 14 Pro deep purple, 256GB. Face ID and camera work perfectly. Minor wear on corners, screen is flawless.",
  },
  {
    id: "dummy-5",
    title: "Nike Air Max — Size 9",
    price: 4999,
    image:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=800&fit=crop&q=80",
    category: "fashion",
    condition: "Like New",
    sellerName: "Ananya Patel",
    sellerRating: 4.6,
    description:
      "Nike Air Max worn twice, UK size 9. Original box included. Selling because size runs slightly small for me.",
  },
  {
    id: "dummy-6",
    title: "Canon EOS R50 Camera Kit",
    price: 52999,
    image:
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&h=800&fit=crop&q=80",
    category: "electronics",
    condition: "Like New",
    sellerName: "Rohit Kapoor",
    sellerRating: 5.0,
    description:
      "Canon EOS R50 with 18-45mm kit lens. Shutter count under 500. Perfect for beginners and travel photography.",
  },
];

export function getDummyListingById(id: string) {
  return DUMMY_TRENDING_LISTINGS.find((item) => item.id === id);
}
