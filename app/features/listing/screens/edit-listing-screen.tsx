/**
 * EditListingScreen - loads a user's listing and allows editing the same
 * details that are captured while posting: pricing, details, category-specific
 * specs, contact, and location.
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
  type KeyboardTypeOptions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { CategorySlug } from "@/constants/categories";
import {
  CATEGORY_MAP,
  CONDITION_OPTIONS,
  CONDITION_SKIP_CATEGORIES,
  PRICE_OPTIONAL_CATEGORIES,
} from "@/constants/categories";
import {
  deleteListing,
  fetchListingById,
  updateListing,
  type ListingItem,
} from "@/features/listing/services/listing-api";
import { Image } from "@/lib/nativewind-interop";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IMAGE_GAP = 12;
const SIDE_IMAGE_SIZE = (SCREEN_WIDTH - 32 - IMAGE_GAP * 2) / 3;

type ExtraFieldType = "text" | "number" | "csv" | "boolean";

type ExtraField = {
  key: string;
  label: string;
  placeholder?: string;
  type?: ExtraFieldType;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  fromListing?: (listing: ListingItem) => unknown;
  toPayload?: (value: string) => unknown;
};

const COMMON_FIELDS: ExtraField[] = [
  { key: "subcategory", label: "Subcategory", placeholder: "Listing subcategory" },
  { key: "currency", label: "Currency", placeholder: "e.g. INR, USD" },
  { key: "phone", label: "Contact Phone", placeholder: "Buyer contact number", keyboardType: "phone-pad" },
  { key: "countryCode", label: "Country Code", placeholder: "e.g. IN, US" },
];

const CATEGORY_EXTRA_FIELDS: Partial<Record<CategorySlug, ExtraField[]>> = {
  properties: [
    { key: "bedrooms", label: "Bedrooms", type: "number" },
    { key: "bathrooms", label: "Bathrooms", type: "number" },
    { key: "furnishing", label: "Furnishing", placeholder: "Fully Furnished / Semi-Furnished / Unfurnished" },
    { key: "squareFeet", label: "Square Feet", type: "number" },
    { key: "features", label: "Amenities", type: "csv", placeholder: "Parking, Lift, Power Backup" },
    { key: "petFriendly", label: "Pet Friendly", type: "boolean", placeholder: "true or false" },
    { key: "availableFrom", label: "Available From", placeholder: "YYYY-MM-DD" },
    { key: "genderPreference", label: "Gender Preference", placeholder: "Any / Male Only / Female Only" },
    { key: "occupancy", label: "Occupancy", placeholder: "Single / Shared / Any" },
  ],
  electronics: [
    { key: "brand", label: "Brand" },
    { key: "model", label: "Model" },
    { key: "warranty", label: "Warranty", placeholder: "Under Warranty / Expired / No Warranty" },
    { key: "purchaseYear", label: "Purchase Year", type: "number" },
    { key: "screenSize", label: "Screen Size" },
    { key: "displayType", label: "Display Type" },
    { key: "processor", label: "Processor" },
    { key: "ram", label: "RAM" },
    { key: "storage", label: "Storage" },
    { key: "capacity", label: "Capacity" },
    { key: "energyRating", label: "Energy Rating" },
    { key: "megapixels", label: "Megapixels" },
    { key: "lensType", label: "Lens Type" },
  ],
  vehicles: [
    { key: "brand", label: "Brand" },
    { key: "model", label: "Model" },
    { key: "variant", label: "Variant" },
    { key: "year", label: "Year", type: "number" },
    { key: "kmDriven", label: "Distance Driven" },
    { key: "mileageUnit", label: "Distance Unit", placeholder: "km or mi" },
    { key: "fuelType", label: "Fuel Type" },
    { key: "transmission", label: "Transmission" },
    { key: "ownership", label: "Ownership" },
    { key: "color", label: "Color" },
    { key: "engineCC", label: "Engine CC" },
    { key: "cycleType", label: "Cycle Type" },
    { key: "gearCount", label: "Gear Count" },
    { key: "frameSize", label: "Frame Size" },
    { key: "compatibleVehicle", label: "Compatible Vehicle" },
    { key: "partCategory", label: "Part Category" },
  ],
  jobs: [
    { key: "companyName", label: "Company Name" },
    { key: "companyEmail", label: "Company Email", keyboardType: "email-address" },
    { key: "applyLink", label: "Apply Link", keyboardType: "url" },
    { key: "jobType", label: "Job Type" },
    { key: "experience", label: "Experience" },
    { key: "education", label: "Education" },
    { key: "employmentType", label: "Employment Type" },
    { key: "workMode", label: "Work Mode" },
    { key: "salaryMin", label: "Salary Min", type: "number", fromListing: (listing) => (listing as any).salaryMin ?? (listing as any).salary?.min },
    { key: "salaryMax", label: "Salary Max", type: "number", fromListing: (listing) => (listing as any).salaryMax ?? (listing as any).salary?.max },
    { key: "salaryType", label: "Salary Type", fromListing: (listing) => (listing as any).salaryType ?? (listing as any).salary?.type },
    { key: "industry", label: "Industry" },
    { key: "positions", label: "Open Positions", type: "number" },
  ],
  takecare: [
    { key: "experience", label: "Experience" },
    { key: "availability", label: "Availability" },
    { key: "age", label: "Age", type: "number" },
    { key: "languages", label: "Languages", type: "csv", placeholder: "English, Hindi" },
    { key: "certifications", label: "Certifications", type: "csv", placeholder: "First Aid, CPR" },
  ],
  events: [
    { key: "eventDate", label: "Event Date", placeholder: "YYYY-MM-DD" },
    { key: "eventTime", label: "Event Time", placeholder: "07:00 PM" },
    { key: "organizer", label: "Organizer" },
    { key: "venue", label: "Venue" },
    { key: "ticketsAvailable", label: "Tickets Available", type: "number" },
    { key: "ageRestriction", label: "Age Restriction" },
    { key: "dressCode", label: "Dress Code" },
  ],
  mobiles: [
    { key: "brand", label: "Brand" },
    { key: "model", label: "Model" },
    { key: "storage", label: "Storage" },
    { key: "ram", label: "RAM" },
    { key: "screenSize", label: "Screen Size" },
    { key: "batteryHealth", label: "Battery Health" },
    { key: "warranty", label: "Warranty" },
    { key: "color", label: "Color" },
  ],
  furniture: [
    { key: "material", label: "Material" },
    { key: "dimensions", label: "Dimensions" },
    { key: "weight", label: "Weight" },
    { key: "assemblyRequired", label: "Assembly Required", placeholder: "Yes or No" },
    { key: "numberOfPieces", label: "Number Of Pieces" },
    { key: "color", label: "Color" },
  ],
  fashion: [
    { key: "brand", label: "Brand" },
    { key: "size", label: "Size" },
    { key: "gender", label: "Gender" },
    { key: "fabricType", label: "Fabric Type" },
    { key: "color", label: "Color" },
  ],
  sports: [
    { key: "brand", label: "Brand" },
    { key: "sportType", label: "Sport Type" },
    { key: "size", label: "Size" },
    { key: "material", label: "Material" },
    { key: "color", label: "Color" },
    { key: "weight", label: "Weight" },
    { key: "ageGroup", label: "Age Group" },
  ],
  collectibles: [
    { key: "brand", label: "Brand" },
    { key: "era", label: "Era" },
    { key: "material", label: "Material" },
    { key: "color", label: "Color" },
    { key: "rarity", label: "Rarity" },
    { key: "authenticity", label: "Authenticity" },
    { key: "origin", label: "Origin" },
  ],
  pets: [
    { key: "breed", label: "Breed" },
    { key: "petAge", label: "Pet Age" },
    { key: "gender", label: "Gender" },
    { key: "vaccinated", label: "Vaccinated" },
    { key: "trained", label: "Trained" },
    { key: "color", label: "Color" },
    { key: "weight", label: "Weight" },
  ],
  books: [
    { key: "author", label: "Author" },
    { key: "isbn", label: "ISBN" },
    { key: "publisher", label: "Publisher" },
    { key: "edition", label: "Edition" },
    { key: "language", label: "Language" },
    { key: "pages", label: "Pages" },
  ],
  beauty: [
    { key: "brand", label: "Brand" },
    { key: "skinType", label: "Skin Type" },
    { key: "shade", label: "Shade" },
    { key: "volume", label: "Volume" },
    { key: "ingredients", label: "Key Ingredients" },
    { key: "expiryDate", label: "Expiry Date" },
    { key: "gender", label: "Gender" },
  ],
  toys: [
    { key: "brand", label: "Brand" },
    { key: "ageGroup", label: "Age Group" },
    { key: "material", label: "Material" },
    { key: "batteryRequired", label: "Battery Required" },
    { key: "playMode", label: "Play Mode" },
    { key: "numberOfPieces", label: "Number Of Pieces" },
    { key: "characterTheme", label: "Character / Theme" },
    { key: "color", label: "Color" },
  ],
  forsale: [
    { key: "brand", label: "Brand" },
    { key: "model", label: "Model" },
    { key: "storage", label: "Storage" },
    { key: "ram", label: "RAM" },
    { key: "screenSize", label: "Screen Size" },
    { key: "batteryHealth", label: "Battery Health" },
    { key: "warranty", label: "Warranty" },
    { key: "color", label: "Color" },
    { key: "material", label: "Material" },
    { key: "dimensions", label: "Dimensions" },
    { key: "weight", label: "Weight" },
    { key: "assemblyRequired", label: "Assembly Required" },
    { key: "numberOfPieces", label: "Number Of Pieces" },
    { key: "size", label: "Size" },
    { key: "gender", label: "Gender" },
    { key: "fabricType", label: "Fabric Type" },
    { key: "author", label: "Author" },
    { key: "isbn", label: "ISBN" },
    { key: "publisher", label: "Publisher" },
    { key: "edition", label: "Edition" },
    { key: "sportType", label: "Sport Type" },
  ],
  services: [
    { key: "serviceArea", label: "Service Area" },
    { key: "priceType", label: "Price Unit", fromListing: (listing) => (listing as any).priceType ?? (listing as any).pricing?.priceType },
    { key: "serviceType", label: "Service Mode" },
    { key: "turnaroundTime", label: "Response Time" },
    { key: "experience", label: "Experience" },
    { key: "availability", label: "Availability" },
    { key: "certification", label: "Certification" },
    { key: "languages", label: "Languages" },
    { key: "teamSize", label: "Team Size" },
    { key: "portfolioLink", label: "Portfolio Link", keyboardType: "url" },
  ],
  others: [],
};

const NUMBER_FIELDS = new Set([
  "price",
  "bedrooms",
  "bathrooms",
  "squareFeet",
  "purchaseYear",
  "year",
  "salaryMin",
  "salaryMax",
  "positions",
  "age",
  "ticketsAvailable",
]);

function valueToText(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "object") {
    const maybeLocation = value as { address?: string; city?: string; state?: string; pincode?: string };
    return [maybeLocation.address, maybeLocation.city, maybeLocation.state, maybeLocation.pincode]
      .filter(Boolean)
      .join(", ");
  }
  return String(value);
}

function csvToArray(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function numberOrUndefined(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function booleanOrString(value: string): boolean | string | undefined {
  const normalised = value.trim().toLowerCase();
  if (!normalised) return undefined;
  if (normalised === "true" || normalised === "yes") return true;
  if (normalised === "false" || normalised === "no") return false;
  return value.trim();
}

function getInitialLocation(listing: ListingItem): string {
  const raw = listing.location;
  if (typeof raw === "string") return raw;
  return valueToText(raw);
}

function getInitialPrice(listing: ListingItem): string {
  const price = listing.price ?? (listing as any).pricing?.basePrice;
  return price != null ? String(price) : "";
}

function getInitialLatLng(listing: ListingItem): { lat: string; lng: string } {
  const lat = (listing as any).lat;
  const lng = (listing as any).lng;
  if (lat != null && lng != null) return { lat: String(lat), lng: String(lng) };
  const coordinates = listing.coordinates?.coordinates;
  if (Array.isArray(coordinates) && coordinates.length === 2) {
    return { lat: String(coordinates[1]), lng: String(coordinates[0]) };
  }
  const locationCoordinates = (listing as any).location?.coordinates;
  if (Array.isArray(locationCoordinates) && locationCoordinates.length === 2) {
    return { lat: String(locationCoordinates[1]), lng: String(locationCoordinates[0]) };
  }
  return { lat: "", lng: "" };
}

function getFieldValue(listing: ListingItem, field: ExtraField): string {
  if (field.fromListing) return valueToText(field.fromListing(listing));
  return valueToText((listing as Record<string, unknown>)[field.key]);
}

function serializeExtraField(field: ExtraField, value: string): unknown {
  if (field.toPayload) return field.toPayload(value);
  if (field.type === "csv") return csvToArray(value);
  if (field.type === "boolean") return booleanOrString(value);
  if (field.type === "number" || NUMBER_FIELDS.has(field.key)) return numberOrUndefined(value);
  return value.trim();
}

function displayCategoryName(categorySlug: CategorySlug, listing: ListingItem | null): string {
  const listingCategory = typeof listing?.category === "string" ? listing.category : "";
  return listingCategory || CATEGORY_MAP[categorySlug]?.name || categorySlug;
}

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

  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [condition, setCondition] = useState("");
  const [location, setLocation] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [extraValues, setExtraValues] = useState<Record<string, string>>({});

  const skipCondition = CONDITION_SKIP_CATEGORIES.includes(categorySlug);
  const priceRequired = !PRICE_OPTIONAL_CATEGORIES.includes(categorySlug);
  const showPriceSection = priceRequired || price.trim().length > 0;
  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const extraFields = useMemo(
    () => [...COMMON_FIELDS, ...(CATEGORY_EXTRA_FIELDS[categorySlug] ?? [])],
    [categorySlug],
  );

  useEffect(() => {
    if (!listingId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetchListingById(categorySlug, listingId);
        if (res.listing) {
          const found = res.listing;
          const coords = getInitialLatLng(found);
          const values: Record<string, string> = {};

          for (const field of extraFields) {
            values[field.key] = getFieldValue(found, field);
          }

          setListing(found);
          setTitle(found.title || "");
          setPrice(getInitialPrice(found));
          setDescription(found.description || "");
          setCondition(found.condition || "");
          setLocation(getInitialLocation(found));
          setLat(coords.lat);
          setLng(coords.lng);
          setExtraValues(values);
        }
      } catch {
        showErrorToast("Error", "Failed to load listing data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [categorySlug, extraFields, listingId]);

  const setExtraValue = useCallback((key: string, value: string) => {
    setExtraValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!listingId || !listing) return;
    if (!title.trim()) {
      showErrorToast("Validation", "Title is required.");
      return;
    }
    if (description.trim().length < 20) {
      showErrorToast("Validation", "Description must be at least 20 characters.");
      return;
    }
    if (!location.trim()) {
      showErrorToast("Validation", "Location is required.");
      return;
    }
    if (priceRequired && numberOrUndefined(price) == null) {
      showErrorToast("Validation", "Price is required.");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
      };

      if (showPriceSection || price.trim()) {
        const parsedPrice = numberOrUndefined(price);
        if (parsedPrice != null) body.price = parsedPrice;
      }
      if (!skipCondition && condition) body.condition = condition;

      for (const field of extraFields) {
        const rawValue = extraValues[field.key] ?? "";
        const payloadValue = serializeExtraField(field, rawValue);
        if (payloadValue !== undefined) body[field.key] = payloadValue;
      }

      const parsedLat = numberOrUndefined(lat);
      const parsedLng = numberOrUndefined(lng);
      if (parsedLat != null && parsedLng != null) {
        body.lat = parsedLat;
        body.lng = parsedLng;
      }

      if (categorySlug === "properties") {
        body.category = typeof listing.category === "string" && listing.category
          ? listing.category
          : "Properties";
      }

      if (categorySlug === "jobs") {
        const salaryMin = numberOrUndefined(extraValues.salaryMin ?? "");
        const salaryMax = numberOrUndefined(extraValues.salaryMax ?? "");
        const salaryType = (extraValues.salaryType ?? "").trim();
        if (salaryMin != null || salaryMax != null || salaryType) {
          body.salary = {
            ...(salaryMin != null ? { min: salaryMin } : {}),
            ...(salaryMax != null ? { max: salaryMax } : {}),
            ...(salaryType ? { type: salaryType } : {}),
          };
        }
      }

      await updateListing(categorySlug, listingId, body);
      showSuccessToast("Updated", "Your listing has been updated successfully.");
      router.back();
    } catch (err: any) {
      showErrorToast("Error", err?.message || "Failed to update listing.");
    } finally {
      setSaving(false);
    }
  }, [
    categorySlug,
    condition,
    description,
    extraFields,
    extraValues,
    lat,
    listing,
    listingId,
    lng,
    location,
    price,
    priceRequired,
    router,
    showPriceSection,
    skipCondition,
    title,
  ]);

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
              showSuccessToast("Deleted", "Listing removed successfully.");
              router.back();
            } catch {
              showErrorToast("Error", "Failed to delete listing.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }, [categorySlug, listingId, router]);

  const images = listing?.images || [];
  const categoryName = displayCategoryName(categorySlug, listing);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F6F7F8]">
        <ActivityIndicator size="large" color="#27BB97" />
        <Text className="mt-3 text-[14px] text-[#6C7A74]">Loading listing...</Text>
      </View>
    );
  }

  if (!listing) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F6F7F8]">
        <MaterialIcons name="error-outline" size={48} color="#94A3B8" />
        <Text className="mt-3 text-[16px] font-semibold text-[#6C7A74]">Listing not found</Text>
        <Pressable onPress={() => router.back()} className="mt-4 rounded-lg bg-[#27BB97] px-6 py-2.5">
          <Text className="text-[14px] font-semibold text-white">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F6F7F8]">
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
          <Text className="text-[20px] font-semibold text-[#161D1A]">Edit Listing</Text>
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
          {images.length > 0 && (
            <View className="mb-6">
              <Text className="mb-4 text-[18px] font-semibold text-[#161D1A]">Photos</Text>
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

          {showPriceSection && (
            <View className="mb-6 rounded-xl border border-[#DDE4DF] bg-white p-5">
              <Text className="text-[18px] font-semibold text-[#161D1A]">Pricing</Text>
              <Text className="mb-4 text-[14px] text-[#6C7A74]">Update the amount buyers see on your listing.</Text>
              <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">Selling Price</Text>
              <View className="mb-4 h-12 flex-row items-center rounded-lg border border-[#BBCAC3] bg-[#F3F4F6] px-4">
                <TextInput
                  value={price}
                  onChangeText={(v) => setPrice(v.replace(/[^0-9.]/g, ""))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  className="flex-1 text-[20px] font-bold text-[#161D1A]"
                  style={{ paddingVertical: 0 }}
                />
              </View>
            </View>
          )}

          <View className="mb-6">
            <Text className="mb-4 px-1 text-[18px] font-semibold text-[#161D1A]">Details</Text>
            <View className="mb-4">
              <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">Title</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Listing title"
                placeholderTextColor="#94A3B8"
                className="rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[16px] text-[#161D1A]"
              />
            </View>
            <View className="mb-4">
              <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">Category</Text>
              <View className="h-12 flex-row items-center justify-between rounded-lg border border-[#BBCAC3] bg-slate-50 px-4">
                <Text className="text-[16px] text-[#6C7A74]">{categoryName}</Text>
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
                placeholder="Describe your listing"
                placeholderTextColor="#94A3B8"
                className="min-h-[120px] rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[16px] text-[#161D1A]"
              />
            </View>
          </View>

          {!skipCondition && (
            <View className="mb-6">
              <Text className="mb-3 px-1 text-[18px] font-semibold text-[#161D1A]">Condition</Text>
              <View className="flex-row flex-wrap gap-2">
                {[...CONDITION_OPTIONS].map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => setCondition(item)}
                    className="rounded-full px-4 py-2"
                    style={{
                      borderWidth: 1.5,
                      borderColor: condition === item ? "#27BB97" : "#E2E8F0",
                      backgroundColor: condition === item ? "rgba(39,187,151,0.1)" : "#FFFFFF",
                    }}
                  >
                    <Text
                      className="text-[13px] font-medium"
                      style={{ color: condition === item ? "#006B55" : "#3C4A44" }}
                    >
                      {item}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View className="mb-6">
            <Text className="mb-4 px-1 text-[18px] font-semibold text-[#161D1A]">More Details</Text>
            <View className="flex-row flex-wrap gap-3">
              {extraFields.map((field) => {
                const isWide = field.multiline || field.type === "csv" || field.key === "phone";
                return (
                  <View key={field.key} style={{ width: isWide ? "100%" : "48%" }}>
                    <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">{field.label}</Text>
                    <TextInput
                      value={extraValues[field.key] ?? ""}
                      onChangeText={(value) => {
                        const nextValue = field.type === "number"
                          ? value.replace(/[^0-9.]/g, "")
                          : value;
                        setExtraValue(field.key, nextValue);
                      }}
                      keyboardType={field.keyboardType ?? (field.type === "number" ? "numeric" : "default")}
                      placeholder={field.placeholder ?? field.label}
                      placeholderTextColor="#94A3B8"
                      multiline={field.multiline || field.type === "csv"}
                      textAlignVertical={field.multiline || field.type === "csv" ? "top" : "center"}
                      className="rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[15px] text-[#161D1A]"
                      style={{ minHeight: field.multiline || field.type === "csv" ? 84 : 48 }}
                    />
                  </View>
                );
              })}
            </View>
          </View>

          <View className="mb-6">
            <Text className="mb-3 px-1 text-[18px] font-semibold text-[#161D1A]">Location</Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Enter location"
              placeholderTextColor="#94A3B8"
              className="mb-3 rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[16px] text-[#161D1A]"
            />
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">Latitude</Text>
                <TextInput
                  value={lat}
                  onChangeText={(value) => setLat(value.replace(/[^0-9.-]/g, ""))}
                  keyboardType="numeric"
                  placeholder="Optional"
                  placeholderTextColor="#94A3B8"
                  className="rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[15px] text-[#161D1A]"
                />
              </View>
              <View className="flex-1">
                <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">Longitude</Text>
                <TextInput
                  value={lng}
                  onChangeText={(value) => setLng(value.replace(/[^0-9.-]/g, ""))}
                  keyboardType="numeric"
                  placeholder="Optional"
                  placeholderTextColor="#94A3B8"
                  className="rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[15px] text-[#161D1A]"
                />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

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
