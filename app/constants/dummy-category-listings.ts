import type { CategorySlug } from "@/constants/categories";
import { DUMMY_TRENDING_LISTINGS } from "@/constants/dummy-trending-listings";
import type { ListingItem } from "@/features/listing/services/listing-api";

type DummySeed = {
  id: string;
  title: string;
  price: number;
  image: string;
  condition?: string;
  location?: string;
};

const EXTRA_BY_CATEGORY: Partial<Record<CategorySlug, DummySeed[]>> = {
  vehicles: [
    {
      id: "dummy-v1",
      title: "Honda City 2020 — Automatic",
      price: 985000,
      image:
        "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=600&h=800&fit=crop&q=80",
      condition: "Good",
      location: "Hyderabad",
    },
    {
      id: "dummy-v2",
      title: "Royal Enfield Classic 350",
      price: 145000,
      image:
        "https://images.unsplash.com/photo-1558981403-c5f9899a1451?w=600&h=800&fit=crop&q=80",
      condition: "Like New",
      location: "Bangalore",
    },
    {
      id: "dummy-v3",
      title: "Mountain Cycle — 21 Speed",
      price: 8500,
      image:
        "https://images.unsplash.com/photo-1576435728678-68d0fbf94e6b?w=600&h=800&fit=crop&q=80",
      condition: "Good",
      location: "Pune",
    },
    {
      id: "dummy-v4",
      title: "Car Alloy Wheels Set (4)",
      price: 22000,
      image:
        "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=600&h=800&fit=crop&q=80",
      condition: "Like New",
      location: "Chennai",
    },
  ],
  jobs: [
    {
      id: "dummy-j1",
      title: "React Native Developer",
      price: 1200000,
      image:
        "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=600&h=800&fit=crop&q=80",
      location: "Remote",
    },
    {
      id: "dummy-j2",
      title: "Sales Executive — Retail",
      price: 360000,
      image:
        "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&h=800&fit=crop&q=80",
      location: "Mumbai",
    },
    {
      id: "dummy-j3",
      title: "Part-time Delivery Partner",
      price: 180000,
      image:
        "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=600&h=800&fit=crop&q=80",
      location: "Delhi NCR",
    },
  ],
  properties: [
    {
      id: "dummy-p1",
      title: "2 BHK Apartment — Furnished",
      price: 18500000,
      image:
        "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&h=800&fit=crop&q=80",
      location: "Gachibowli",
    },
    {
      id: "dummy-p2",
      title: "3 BHK Independent House",
      price: 24500000,
      image:
        "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&h=800&fit=crop&q=80",
      location: "Whitefield",
    },
    {
      id: "dummy-p3",
      title: "Single Room — PG for Men",
      price: 12000,
      image:
        "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&h=800&fit=crop&q=80",
      location: "Koramangala",
    },
  ],
  events: [
    {
      id: "dummy-e1",
      title: "Indie Music Night — Live",
      price: 499,
      image:
        "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600&h=800&fit=crop&q=80",
      location: "HITEC City",
    },
    {
      id: "dummy-e2",
      title: "Food Truck Festival",
      price: 0,
      image:
        "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&h=800&fit=crop&q=80",
      location: "Jubilee Hills",
    },
    {
      id: "dummy-e3",
      title: "Startup Networking Meetup",
      price: 199,
      image:
        "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&h=800&fit=crop&q=80",
      location: "Madhapur",
    },
  ],
  fashion: [
    {
      id: "dummy-f1",
      title: "Men's Formal Blazer",
      price: 2999,
      image:
        "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&h=800&fit=crop&q=80",
      condition: "Like New",
    },
    {
      id: "dummy-f2",
      title: "Women's Summer Dress",
      price: 1899,
      image:
        "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=600&h=800&fit=crop&q=80",
      condition: "New",
    },
  ],
  sports: [
    {
      id: "dummy-s1",
      title: "Yoga Mat + Blocks Set",
      price: 1299,
      image:
        "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&h=800&fit=crop&q=80",
      condition: "Good",
    },
    {
      id: "dummy-s2",
      title: "Cricket Bat — English Willow",
      price: 4500,
      image:
        "https://images.unsplash.com/photo-1531415071028-05edfd68a2fe?w=600&h=800&fit=crop&q=80",
      condition: "Like New",
    },
  ],
  pets: [
    {
      id: "dummy-pet1",
      title: "Dog Crate — Medium Size",
      price: 3500,
      image:
        "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=600&h=800&fit=crop&q=80",
      condition: "Good",
    },
    {
      id: "dummy-pet2",
      title: "Cat Tree Scratching Post",
      price: 2200,
      image:
        "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=600&h=800&fit=crop&q=80",
      condition: "Like New",
    },
  ],
  books: [
    {
      id: "dummy-b1",
      title: "Atomic Habits — Paperback",
      price: 399,
      image:
        "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&h=800&fit=crop&q=80",
      condition: "Good",
    },
    {
      id: "dummy-b2",
      title: "Engineering Maths Textbook Set",
      price: 899,
      image:
        "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&h=800&fit=crop&q=80",
      condition: "Fair",
    },
  ],
  beauty: [
    {
      id: "dummy-be1",
      title: "Skincare Bundle — Unopened",
      price: 2499,
      image:
        "https://images.unsplash.com/photo-1556228578-8c89e20adf5f?w=600&h=800&fit=crop&q=80",
      condition: "New",
    },
  ],
  toys: [
    {
      id: "dummy-t1",
      title: "LEGO City Set — Complete",
      price: 3200,
      image:
        "https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=600&h=800&fit=crop&q=80",
      condition: "Like New",
    },
  ],
  collectibles: [
    {
      id: "dummy-c1",
      title: "Vintage Film Camera",
      price: 12500,
      image:
        "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&h=800&fit=crop&q=80",
      condition: "Good",
    },
  ],
  takecare: [
    {
      id: "dummy-tc1",
      title: "Experienced Nanny — Weekdays",
      price: 18000,
      image:
        "https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=600&h=800&fit=crop&q=80",
      location: "Local",
    },
  ],
  others: [
    {
      id: "dummy-o1",
      title: "Moving Boxes — Pack of 10",
      price: 450,
      image:
        "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&h=800&fit=crop&q=80",
      condition: "New",
    },
  ],
};

function seedToListing(seed: DummySeed, categorySlug: CategorySlug): ListingItem {
  const base = {
    _id: seed.id,
    title: seed.title,
    price: seed.price,
    images: [seed.image],
    category: categorySlug,
    condition: seed.condition,
    location: seed.location,
  };

  if (categorySlug === "jobs") {
    return {
      ...base,
      jobType: "Full Time",
      workMode: "Hybrid",
      companyName: "Listify Partner",
      salary: {
        min: Math.round(seed.price * 0.85),
        max: seed.price,
      },
    } as ListingItem;
  }

  if (categorySlug === "events") {
    return {
      ...base,
      eventDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      eventTime: "7:00 PM",
    } as ListingItem;
  }

  return base as ListingItem;
}

/** Dummy listings for browse screens — always merged with API results. */
export function getDummyListingsForCategory(categorySlug: CategorySlug): ListingItem[] {
  const fromTrending = DUMMY_TRENDING_LISTINGS.filter((d) => d.category === categorySlug).map(
    (d) =>
      ({
        _id: d.id,
        title: d.title,
        price: d.price,
        images: [d.image],
        category: d.category,
        condition: d.condition,
        sellerName: d.sellerName,
      }) as ListingItem,
  );

  const extra = (EXTRA_BY_CATEGORY[categorySlug] ?? []).map((s) =>
    seedToListing(s, categorySlug),
  );

  const fallback =
    fromTrending.length === 0 && extra.length === 0
      ? DUMMY_TRENDING_LISTINGS.slice(0, 4).map((d, i) =>
          seedToListing(
            {
              id: `dummy-fb-${categorySlug}-${i}`,
              title: d.title,
              price: d.price,
              image: d.image,
              condition: d.condition,
              location: "India",
            },
            categorySlug,
          ),
        )
      : [];

  return [...fromTrending, ...extra, ...fallback];
}

export function mergeListingsWithDummy(
  apiItems: ListingItem[],
  categorySlug: CategorySlug,
): ListingItem[] {
  const dummies = getDummyListingsForCategory(categorySlug);
  const seen = new Set(apiItems.map((item) => item._id));
  const merged = [...apiItems];
  for (const item of dummies) {
    if (!seen.has(item._id)) {
      merged.push(item);
      seen.add(item._id);
    }
  }
  return merged.length > 0 ? merged : dummies;
}
