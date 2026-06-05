/**
 * EditListingScreen - loads a user's listing and allows editing the same
 * details that are captured while posting: pricing, details, category-specific
 * specs, contact, and location.
 */
import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "@/lib/safe-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from "react-native";

import { SellFlowLayout, SellSectionCard } from "@/components/sell-flow-layout";
import type { CategorySlug } from "@/constants/categories";
import {
  CATEGORY_MAP,
  CONDITION_OPTIONS,
  CONDITION_SKIP_CATEGORIES,
  PRICE_OPTIONAL_CATEGORIES,
} from "@/constants/categories";
import {
  buildGoogleMapsUrl,
  buildOpenStreetMapPreviewUrl,
  parseListingCoordinates,
} from "@/lib/listing-coordinates";
import {
  checkImageModeration,
  deleteListing,
  fetchListingById,
  uploadListingImages,
  updateListing,
  type ListingItem,
} from "@/features/listing/services/listing-api";
import { Image } from "@/lib/nativewind-interop";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { ListifyFonts } from "@/constants/typography";

const MAX_IMAGES = 6;

type ImageScanStatus = "scanning" | "allowed" | "blocked" | "review" | "error";
type ImageScanResult = { status: ImageScanStatus; category?: string; message?: string };

const MODERATION_CATEGORY_SHORT: Record<string, string> = {
  explicit_sexual: "Explicit",
  sexual: "Adult content",
  graphic_violence: "Violence",
  violence: "Violence",
  racy: "Suggestive",
  illegal_drugs: "Drugs",
  illegal_drugs_web: "Drugs",
  weapon: "Weapon",
  weapon_web: "Weapon",
  hate_symbol: "Hate symbol",
};

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

function getListingMapCoords(listing: ListingItem | null) {
  if (!listing) return null;

  const parsed = parseListingCoordinates(listing as { coordinates?: unknown });
  if (parsed) return parsed;

  const directLat = Number((listing as any).lat);
  const directLng = Number((listing as any).lng);
  if (Number.isFinite(directLat) && Number.isFinite(directLng)) {
    return { lat: directLat, lng: directLng };
  }

  const locationCoordinates = (listing as any).location?.coordinates;
  if (Array.isArray(locationCoordinates) && locationCoordinates.length >= 2) {
    const lng = Number(locationCoordinates[0]);
    const lat = Number(locationCoordinates[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }

  return null;
}

function getInitialPrice(listing: ListingItem): string {
  const price = listing.price ?? (listing as any).pricing?.basePrice;
  return price != null ? String(price) : "";
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

function isRemoteImageUri(uri: string): boolean {
  return /^https?:\/\//i.test(uri);
}

export function EditListingScreen() {
  const router = useRouter();
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
  const [extraValues, setExtraValues] = useState<Record<string, string>>({});
  const [editableImageUris, setEditableImageUris] = useState<string[]>([]);
  const [imageScanMap, setImageScanMap] = useState<Record<string, ImageScanResult>>({});

  const skipCondition = CONDITION_SKIP_CATEGORIES.includes(categorySlug);
  const priceRequired = !PRICE_OPTIONAL_CATEGORIES.includes(categorySlug);
  const showPriceSection = priceRequired || price.trim().length > 0;
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
          setExtraValues(values);
          setEditableImageUris(found.images || []);
          setImageScanMap({});
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

  const runImageModeration = useCallback(async (uris: string[]) => {
    if (uris.length === 0) return true;

    setImageScanMap((prev) => ({
      ...(prev ?? {}),
      ...Object.fromEntries(uris.map((uri) => [uri, { status: "scanning" } as ImageScanResult])),
    }));

    try {
      const modResult = await checkImageModeration(uris);
      const results = Array.isArray(modResult?.results) ? modResult.results : [];

      if (!modResult?.success || results.length === 0) {
        throw new Error("AI image scan did not return a valid result.");
      }

      setImageScanMap((prev) => {
        const next = { ...(prev ?? {}) };
        uris.forEach((uri, index) => {
          const scanResult = results[index];
          if (!scanResult) {
            next[uri] = {
              status: "error",
              message: "AI scan incomplete. Please retry.",
            };
            return;
          }

          next[uri] = {
            status:
              scanResult.decision === "block"
                ? "blocked"
                : scanResult.decision === "review"
                  ? "review"
                  : "allowed",
            category: scanResult.category,
          };
        });
        return next;
      });

      const hasError = uris.some((uri, index) => !results[index]);
      if (hasError) {
        showErrorToast("AI scan incomplete", "Some photos could not be scanned. Retry before saving.");
        return false;
      }

      return true;
    } catch (error: any) {
      const message = error?.message || "AI image scan failed. Please retry.";
      setImageScanMap((prev) => ({
        ...(prev ?? {}),
        ...Object.fromEntries(uris.map((uri) => [uri, { status: "error", message } as ImageScanResult])),
      }));
      showErrorToast("AI scan failed", message);
      return false;
    }
  }, []);

  const pickImages = useCallback(async () => {
    const remaining = MAX_IMAGES - editableImageUris.length;
    if (remaining <= 0) {
      showErrorToast("Photos limit", `You can add up to ${MAX_IMAGES} photos.`);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    });

    if (result.canceled) return;

    const newUris = result.assets.map((asset) => asset.uri);
    setEditableImageUris((prev) => [...prev, ...newUris]);
    await runImageModeration(newUris);
  }, [editableImageUris.length, runImageModeration]);

  const retryErroredScans = useCallback(async () => {
    const erroredUris = editableImageUris.filter((uri) => imageScanMap[uri]?.status === "error");
    if (erroredUris.length === 0) return;
    await runImageModeration(erroredUris);
  }, [editableImageUris, imageScanMap, runImageModeration]);

  const removeImage = useCallback((uri: string) => {
    setEditableImageUris((prev) => prev.filter((item) => item !== uri));
    setImageScanMap((prev) => {
      const next = { ...(prev ?? {}) };
      delete next[uri];
      return next;
    });
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

    if (editableImageUris.length === 0) {
      showErrorToast("Photos required", "Please keep at least one photo on the listing.");
      return;
    }

    const imagesNeedingScan = editableImageUris.filter(
      (uri) => !isRemoteImageUri(uri) && (!imageScanMap[uri] || imageScanMap[uri]?.status === "error"),
    );
    if (imagesNeedingScan.length > 0) {
      const moderationReady = await runImageModeration(imagesNeedingScan);
      if (!moderationReady) {
        return;
      }
    }

    const hasScanningImages = editableImageUris.some((uri) => imageScanMap[uri]?.status === "scanning");
    if (hasScanningImages) {
      showErrorToast("Please wait", "Images are still being scanned for policy compliance.");
      return;
    }

    const firstErroredUri = editableImageUris.find((uri) => imageScanMap[uri]?.status === "error");
    if (firstErroredUri) {
      showErrorToast(
        "AI scan required",
        imageScanMap[firstErroredUri]?.message || "One or more photos could not be scanned. Retry before saving.",
      );
      return;
    }

    const firstBlockedUri = editableImageUris.find((uri) => imageScanMap[uri]?.status === "blocked");
    if (firstBlockedUri) {
      showErrorToast(
        "Restricted image",
        `Remove images marked RESTRICTED (${MODERATION_CATEGORY_SHORT[imageScanMap[firstBlockedUri]?.category ?? ""] ?? "Policy violation"}).`,
      );
      return;
    }

    const firstFlaggedUri = editableImageUris.find((uri) => imageScanMap[uri]?.status === "review");
    if (firstFlaggedUri) {
      showErrorToast(
        "Image flagged",
        `Remove images marked FLAGGED (${MODERATION_CATEGORY_SHORT[imageScanMap[firstFlaggedUri]?.category ?? ""] ?? "Review needed"}) before saving.`,
      );
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

      const existingRemoteImages = editableImageUris.filter(isRemoteImageUri);
      const newLocalImages = editableImageUris.filter((uri) => !isRemoteImageUri(uri));
      let uploadedImages: string[] = [];

      if (newLocalImages.length > 0) {
        const uploadResult = await uploadListingImages(categorySlug, newLocalImages);
        uploadedImages = uploadResult.images ?? [];
        if (uploadedImages.length !== newLocalImages.length) {
          throw new Error("Some images could not be uploaded. Please try again.");
        }
      }

      body.images = [...existingRemoteImages, ...uploadedImages];

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
    editableImageUris,
    extraFields,
    extraValues,
    imageScanMap,
    listing,
    listingId,
    location,
    price,
    priceRequired,
    router,
    runImageModeration,
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

  const categoryName = displayCategoryName(categorySlug, listing);
  const mapCoords = useMemo(() => getListingMapCoords(listing), [listing]);
  const mapPreviewUrl = useMemo(() => {
    if (!mapCoords) return null;
    return buildOpenStreetMapPreviewUrl(mapCoords.lat, mapCoords.lng);
  }, [mapCoords]);
  const mapUrl = useMemo(() => buildGoogleMapsUrl(mapCoords, location), [mapCoords, location]);
  const handleOpenMap = useCallback(() => {
    if (!mapUrl) return;
    Linking.openURL(mapUrl).catch(() => {
      showErrorToast("Map unavailable", "Could not open the location in Maps.");
    });
  }, [mapUrl]);

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
    <SellFlowLayout
      step={2}
      title="Edit listing"
      subtitle="Update details, photos and contact"
      onBack={() => router.back()}
      rightAction={
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
      }
      footerLabel="Editing"
      footerMeta={categoryName}
      primaryLabel="Update listing"
      onPrimaryPress={handleSave}
      primaryDisabled={saving || deleting || editableImageUris.some((uri) => imageScanMap[uri]?.status === "scanning")}
      primaryLoading={saving}
    >
      <SellSectionCard title="Photos">
        <View className="px-4 py-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text className="text-[13px] text-[#6B7280]" style={{ fontFamily: ListifyFonts.regular }}>
              Add up to {MAX_IMAGES} photos
            </Text>
            <Text className="text-[12px] text-[#9CA3AF]" style={{ fontFamily: ListifyFonts.medium }}>
              {editableImageUris.length} / {MAX_IMAGES}
            </Text>
          </View>

          {editableImageUris.some((uri) => imageScanMap[uri]?.status === "error") ? (
            <View className="mb-3 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-3">
              <View className="flex-row items-center justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-[13px] text-[#991B1B]" style={{ fontFamily: ListifyFonts.semiBold }}>
                    AI scan failed for one or more photos
                  </Text>
                  <Text className="mt-1 text-[12px] text-[#B91C1C]" style={{ fontFamily: ListifyFonts.regular }}>
                    Retry the scan before updating the listing.
                  </Text>
                </View>
                <Pressable
                  onPress={retryErroredScans}
                  className="rounded-full bg-[#DC2626] px-3 py-2"
                >
                  <Text className="text-[12px] text-white" style={{ fontFamily: ListifyFonts.semiBold }}>
                    Retry AI
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View className="flex-row flex-wrap gap-3">
            {editableImageUris.length < MAX_IMAGES ? (
              <Pressable
                onPress={pickImages}
                className="items-center justify-center rounded-2xl border-2 border-dashed border-[#E5E7EB] bg-[#F9FAFB]"
                style={{ width: 96, height: 96 }}
              >
                <MaterialIcons name="add-a-photo" size={26} color="#9CA3AF" />
                <Text className="mt-1 text-[10px] text-[#6B7280]" style={{ fontFamily: ListifyFonts.medium }}>
                  Add
                </Text>
              </Pressable>
            ) : null}

            {editableImageUris.map((uri, idx) => {
              const scan = imageScanMap[uri];
              return (
                <View
                  key={`${uri}-${idx}`}
                  className="overflow-hidden rounded-2xl border border-[#E5E7EB]"
                  style={{ width: 96, height: 96 }}
                >
                  <Image source={uri} contentFit="cover" className="h-full w-full" />

                  {idx === 0 ? (
                    <View className="absolute left-2 top-2 rounded-full bg-white/85 px-2 py-0.5">
                      <Text className="text-[9px] text-[#004535]" style={{ fontFamily: ListifyFonts.bold }}>
                        COVER
                      </Text>
                    </View>
                  ) : null}

                  {scan?.status === "scanning" ? (
                    <View className="absolute inset-0 items-center justify-center bg-black/55" style={{ borderRadius: 16 }}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text className="mt-1 text-[9px] text-white" style={{ fontFamily: ListifyFonts.medium }}>
                        Scanning...
                      </Text>
                    </View>
                  ) : null}

                  {scan?.status === "blocked" ? (
                    <View className="absolute inset-0 items-center justify-center" style={{ borderRadius: 16, backgroundColor: "rgba(185,28,28,0.92)" }}>
                      <MaterialIcons name="block" size={26} color="#FFFFFF" />
                      <Text className="mt-1 text-[10px] tracking-widest text-white" style={{ fontFamily: ListifyFonts.bold }}>
                        RESTRICTED
                      </Text>
                      <Text className="mt-0.5 px-1 text-center text-[8px] text-white/80" style={{ fontFamily: ListifyFonts.regular }}>
                        {MODERATION_CATEGORY_SHORT[scan.category ?? ""] ?? "Policy violation"}
                      </Text>
                    </View>
                  ) : null}

                  {scan?.status === "review" ? (
                    <View className="absolute inset-0 items-center justify-center" style={{ borderRadius: 16, backgroundColor: "rgba(194,65,12,0.88)" }}>
                      <MaterialIcons name="warning" size={24} color="#FFFFFF" />
                      <Text className="mt-1 text-[9px] tracking-widest text-white" style={{ fontFamily: ListifyFonts.bold }}>
                        FLAGGED
                      </Text>
                      <Text className="mt-0.5 px-1 text-center text-[8px] text-white/80" style={{ fontFamily: ListifyFonts.regular }}>
                        {MODERATION_CATEGORY_SHORT[scan.category ?? ""] ?? "Review needed"}
                      </Text>
                    </View>
                  ) : null}

                  {scan?.status === "error" ? (
                    <View className="absolute inset-0 items-center justify-center" style={{ borderRadius: 16, backgroundColor: "rgba(127,29,29,0.92)" }}>
                      <MaterialIcons name="sync-problem" size={24} color="#FFFFFF" />
                      <Text className="mt-1 text-[9px] tracking-widest text-white" style={{ fontFamily: ListifyFonts.bold }}>
                        SCAN FAILED
                      </Text>
                      <Text className="mt-0.5 px-1 text-center text-[8px] text-white/80" style={{ fontFamily: ListifyFonts.regular }}>
                        Retry AI scan
                      </Text>
                    </View>
                  ) : null}

                  <Pressable
                    onPress={() => removeImage(uri)}
                    className="absolute right-1 top-1 rounded-full bg-white/90 p-1"
                  >
                    <MaterialIcons name="close" size={16} color="#DC2626" />
                  </Pressable>
                </View>
              );
            })}
          </View>

          <Text className="mt-3 text-[12px] text-[#6B7280]" style={{ fontFamily: ListifyFonts.regular }}>
            Photos added here will be scanned before the listing is updated.
          </Text>
        </View>
      </SellSectionCard>

      {showPriceSection ? (
        <SellSectionCard title="Pricing">
          <View className="p-5">
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
        </SellSectionCard>
      ) : null}

      <SellSectionCard title="Details" className="mb-6">
        <View className="p-5">
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
                className="min-h-30 rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[16px] text-[#161D1A]"
              />
            </View>
        </View>
      </SellSectionCard>

      {!skipCondition ? (
        <SellSectionCard title="Condition" className="mb-6">
          <View className="p-5">
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
        </SellSectionCard>
      ) : null}

      <SellSectionCard title="More details" className="mb-6">
        <View className="p-5">
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
      </SellSectionCard>

      <SellSectionCard title="Location" className="mb-6">
        <View className="p-5">
            <Text className="mb-3 px-1 text-[18px] font-semibold text-[#161D1A]">Location</Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Enter location"
              placeholderTextColor="#94A3B8"
              className="mb-3 rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[16px] text-[#161D1A]"
            />

            {mapPreviewUrl ? (
              <Pressable
                onPress={handleOpenMap}
                className="overflow-hidden rounded-2xl border border-[#DDE4DF] bg-[#F8FAFC]"
                style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
              >
                <Image
                  source={mapPreviewUrl}
                  contentFit="cover"
                  className="h-44 w-full"
                />
                <View className="flex-row items-center justify-between px-4 py-3">
                  <View className="flex-1 pr-3">
                    <Text className="text-[13px] text-[#111827]" style={{ fontFamily: ListifyFonts.semiBold }}>
                      Saved location preview
                    </Text>
                    <Text className="mt-1 text-[12px] text-[#6B7280]" style={{ fontFamily: ListifyFonts.regular }}>
                      Tap to open this location in Maps.
                    </Text>
                  </View>
                  <View className="h-9 w-9 items-center justify-center rounded-full bg-[#ECFDF5]">
                    <MaterialIcons name="open-in-new" size={18} color="#059669" />
                  </View>
                </View>
              </Pressable>
            ) : (
              <View className="rounded-2xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB] px-4 py-4">
                <Text className="text-[13px] text-[#374151]" style={{ fontFamily: ListifyFonts.medium }}>
                  Map preview unavailable
                </Text>
                <Text className="mt-1 text-[12px] text-[#6B7280]" style={{ fontFamily: ListifyFonts.regular }}>
                  This listing does not have saved coordinates yet, so only the location text is shown.
                </Text>
              </View>
            )}
        </View>
      </SellSectionCard>
    </SellFlowLayout>
  );
}
