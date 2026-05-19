import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { type Href, useRouter } from "@/lib/safe-router";
import { useCallback, useEffect } from "react";
import {
  Alert,
  BackHandler,
  Pressable,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { SellFlowLayout, SellSectionCard } from "@/components/sell-flow-layout";
import { ListifyFonts } from "@/constants/typography";

import {
  CATEGORY_MAP,
  CONDITION_SKIP_CATEGORIES,
  PRICE_OPTIONAL_CATEGORIES,
  FORSALE_SUBCATEGORY_TO_CATEGORY,
} from "@/constants/categories";
import {
  checkImageModeration,
  createListing,
  uploadListingImages,
} from "@/features/listing/services/listing-api";
import { Image } from "@/lib/nativewind-interop";
import { PostLocationMapPreview } from "@/components/post-location-map-preview";
import { PhoneInputWithCountry } from "@/components/phone-input-with-country";
import { LocationAutocompleteInput } from "@/components/location-autocomplete-input";
import { useLocale } from "@/providers/locale-provider";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { refreshDeviceLocation, selectLocationCoords, setLocationDirect } from "@/store/slices/location-slice";
import {
  addImageUri,
  removeImageUri,
  resetPostForm,
  setLocation,
  setPhone,
  setPhoneCode,
  setSubmitError,
  setSubmitting,
  setUploadedImageUrls,
} from "@/store/slices/post-form-slice";

export function PostAdStep3MediaScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { phoneCode: localePhoneCode } = useLocale();

  const {
    category, subcategory, title, description, price, condition, location, listingType,
    bedrooms, bathrooms, furnishing, squareFeet, features, petFriendly, availableFrom,
    genderPreference, occupancy,
    brand, model: productModel, warranty, purchaseYear, screenSize, displayType,
    processor, ram, storage, capacity, energyRating, megapixels, lensType,
    variant, year, kmDriven, fuelType, transmission, ownership, color, engineCC,
    cycleType, gearCount, frameSize, compatibleVehicle, partCategory,
    companyName, companyEmail, applyLink, jobType, experience, education,
    employmentType, workMode, salaryMin, salaryMax, salaryType, industry, positions,
    availability, age, languages, certifications,
    eventDate, eventTime, organizer, venue, ticketsAvailable, ageRestriction, dressCode,
    batteryHealth,
    material, dimensions, weight, assemblyRequired, numberOfPieces,
    size, gender, fabricType,
    sportType, ageGroup,
    era, rarity, authenticity, origin,
    breed, petAge, vaccinated, trained,
    author, isbn, publisher, edition, language, pages,
    skinType, shade, volume, ingredients, expiryDate,
    batteryRequired, playMode, characterTheme,
    imageUris, phone, phoneCode, isSubmitting, submitError,
  } = useAppSelector((s) => s.postForm);

  const locationStatus = useAppSelector((s) => s.location.status);
  const locationCoords = useAppSelector(selectLocationCoords);
  const globalLocationLabel = useAppSelector((s) => s.location.label);
  const globalLocationSource = useAppSelector((s) => s.location.source);

  // On mount: pre-populate location from the app-wide location if the form field is empty
  useEffect(() => {
    if (!location && globalLocationSource !== null && globalLocationLabel !== "Set location") {
      dispatch(setLocation(globalLocationLabel));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync phone code with locale (updates when location changes globally)
  useEffect(() => {
    if (localePhoneCode && localePhoneCode !== phoneCode) {
      dispatch(setPhoneCode(localePhoneCode));
    }
  }, [localePhoneCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBack = () => {
    router.replace("/post-ad-step2-details" as Href);
  };

  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        handleBack();
        return true;
      };

      const sub = BackHandler.addEventListener(
        "hardwareBackPress",
        onHardwareBack,
      );
      return () => sub.remove();
    }, [router]),
  );

  const handleUseCurrentLocation = async () => {
    try {
      const result = await dispatch(refreshDeviceLocation()).unwrap();
      dispatch(setLocation(result.label));
    } catch {
      Alert.alert(
        "Location unavailable",
        "Enable location permission or enter your area manually.",
      );
    }
  };

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 6 - imageUris.length,
      quality: 0.8,
    });

    if (!result.canceled) {
      for (const asset of result.assets) {
        dispatch(addImageUri(asset.uri));
      }
    }
  };

  const handleSubmit = async () => {
    if (imageUris.length === 0) {
      Alert.alert("Photos required", "Please add at least one photo.");
      return;
    }
    if (!title || title.length < 3) {
      Alert.alert("Title too short", "Title must be at least 3 characters.");
      return;
    }
    if (!description || description.length < 20) {
      Alert.alert("Description too short", "Description must be at least 20 characters.");
      return;
    }
    if (!location || location.length < 2) {
      Alert.alert("Location required", "Please enter a location (at least 2 characters).");
      return;
    }

    dispatch(setSubmitting(true));
    dispatch(setSubmitError(null));

    try {
      // 0. Moderate images before upload
      const moderationResult = await checkImageModeration(imageUris);
      if (moderationResult.overallDecision === "block") {
        const blockedFiles = moderationResult.results
          .filter((r) => r.decision === "block")
          .map((r) => r.filename)
          .join(", ");
        dispatch(setSubmitting(false));
        Alert.alert(
          "Image Blocked",
          `One or more images contain inappropriate content and cannot be posted. Please remove or replace them.\n\nAffected: ${blockedFiles}`,
        );
        return;
      }
      if (moderationResult.overallDecision === "review") {
        const reviewFiles = moderationResult.results
          .filter((r) => r.decision === "review")
          .map((r) => r.filename)
          .join(", ");
        dispatch(setSubmitting(false));
        Alert.alert(
          "Image Under Review",
          `Some images may contain sensitive content and need to be reviewed. Please remove or replace them before posting.\n\nAffected: ${reviewFiles}`,
        );
        return;
      }

      // 1. Upload images to S3
      const uploadResult = await uploadListingImages(category, imageUris);
      const imageUrls = uploadResult.images ?? [];
      dispatch(setUploadedImageUrls(imageUrls));

      console.log("[PostAd] uploadResult keys:", Object.keys(uploadResult));
      console.log("[PostAd] imageUrls count:", imageUrls.length, imageUrls);

      if (imageUrls.length === 0) {
        throw new Error("Image upload succeeded but no URLs were returned. Please try again.");
      }

      // 2. Create listing
      const categoryConfig = CATEGORY_MAP[category];

      // Resolve the category name to send to the server
      let serverCategory: string;
      if (category === "properties") {
        serverCategory = listingType; // "Properties" or "Rentals"
      } else if (category === "forsale" && subcategory) {
        // ForSale controller expects sub-group name (e.g. "Mobiles", "Furniture")
        serverCategory = FORSALE_SUBCATEGORY_TO_CATEGORY[subcategory] ?? "Others";
      } else {
        serverCategory = categoryConfig?.name ?? category;
      }

      const skipCondition = CONDITION_SKIP_CATEGORIES.includes(category);
      const priceOptional = PRICE_OPTIONAL_CATEGORIES.includes(category);

      const listingBody: Record<string, unknown> = {
        title,
        description,
        ...(!priceOptional || price ? { price: Number(price) } : {}),
        ...(!skipCondition ? { condition } : {}),
        category: serverCategory,
        subcategory,
        images: imageUrls,
        imageUrls,
        location,
        ...(phone ? { phone: `${phoneCode}${phone}` } : {}),
      };

      // Attach property-specific fields
      if (category === "properties") {
        if (bedrooms) listingBody.bedrooms = Number(bedrooms);
        if (bathrooms) listingBody.bathrooms = Number(bathrooms);
        if (furnishing) listingBody.furnishing = furnishing;
        if (squareFeet) listingBody.squareFeet = Number(squareFeet);
        if (features.length > 0) listingBody.features = features;
        listingBody.petFriendly = petFriendly;
        if (availableFrom) listingBody.availableFrom = availableFrom;
        if (genderPreference) listingBody.genderPreference = genderPreference;
        if (occupancy) listingBody.occupancy = occupancy;
      }

      // Attach electronics-specific fields
      if (category === "electronics") {
        if (brand) listingBody.brand = brand;
        if (productModel) listingBody.model = productModel;
        if (warranty) listingBody.warranty = warranty;
        if (purchaseYear) listingBody.purchaseYear = Number(purchaseYear);
        if (screenSize) listingBody.screenSize = screenSize;
        if (displayType) listingBody.displayType = displayType;
        if (processor) listingBody.processor = processor;
        if (ram) listingBody.ram = ram;
        if (storage) listingBody.storage = storage;
        if (capacity) listingBody.capacity = capacity;
        if (energyRating) listingBody.energyRating = energyRating;
        if (megapixels) listingBody.megapixels = megapixels;
        if (lensType) listingBody.lensType = lensType;
      }

      // Attach vehicle-specific fields
      if (category === "vehicles") {
        if (brand) listingBody.brand = brand;
        if (productModel) listingBody.model = productModel;
        if (variant) listingBody.variant = variant;
        if (year) listingBody.year = year;
        if (kmDriven) listingBody.kmDriven = kmDriven;
        if (fuelType) listingBody.fuelType = fuelType;
        if (transmission) listingBody.transmission = transmission;
        if (ownership) listingBody.ownership = ownership;
        if (color) listingBody.color = color;
        if (engineCC) listingBody.engineCC = engineCC;
        if (cycleType) listingBody.cycleType = cycleType;
        if (gearCount) listingBody.gearCount = gearCount;
        if (frameSize) listingBody.frameSize = frameSize;
        if (compatibleVehicle) listingBody.compatibleVehicle = compatibleVehicle;
        if (partCategory) listingBody.partCategory = partCategory;
      }

      // Attach job-specific fields
      if (category === "jobs") {
        if (companyName) listingBody.companyName = companyName;
        if (companyEmail) listingBody.companyEmail = companyEmail;
        if (applyLink) listingBody.applyLink = applyLink;
        if (jobType) listingBody.jobType = jobType;
        if (experience) listingBody.experience = experience;
        if (education) listingBody.education = education;
        if (employmentType) listingBody.employmentType = employmentType;
        if (workMode) listingBody.workMode = workMode;
        if (salaryMin || salaryMax) {
          listingBody.salary = {
            ...(salaryMin ? { min: Number(salaryMin) } : {}),
            ...(salaryMax ? { max: Number(salaryMax) } : {}),
            ...(salaryType ? { type: salaryType } : {}),
          };
        }
        if (salaryType) listingBody.salaryType = salaryType;
        if (industry) listingBody.industry = industry;
        if (positions) listingBody.positions = Number(positions);
      }

      // Attach takecare-specific fields
      if (category === "takecare") {
        if (experience) listingBody.experience = experience;
        if (availability) listingBody.availability = availability;
        if (age) listingBody.age = Number(age);
        if (languages.length > 0) listingBody.languages = languages;
        if (certifications.length > 0) listingBody.certifications = certifications;
      }

      // Attach event-specific fields
      if (category === "events") {
        if (eventDate) listingBody.eventDate = eventDate;
        if (eventTime) listingBody.eventTime = eventTime;
        if (organizer) listingBody.organizer = organizer;
        if (venue) listingBody.venue = venue;
        if (ticketsAvailable) listingBody.ticketsAvailable = Number(ticketsAvailable);
        if (ageRestriction) listingBody.ageRestriction = ageRestriction;
        if (dressCode) listingBody.dressCode = dressCode;
      }

      // Attach mobile-specific fields
      if (category === "mobiles") {
        if (brand) listingBody.brand = brand;
        if (productModel) listingBody.model = productModel;
        if (storage) listingBody.storage = storage;
        if (ram) listingBody.ram = ram;
        if (screenSize) listingBody.screenSize = screenSize;
        if (batteryHealth) listingBody.batteryHealth = batteryHealth;
        if (warranty) listingBody.warranty = warranty;
        if (color) listingBody.color = color;
      }

      // Attach furniture-specific fields
      if (category === "furniture") {
        if (material) listingBody.material = material;
        if (dimensions) listingBody.dimensions = dimensions;
        if (weight) listingBody.weight = weight;
        if (assemblyRequired) listingBody.assemblyRequired = assemblyRequired;
        if (numberOfPieces) listingBody.numberOfPieces = numberOfPieces;
        if (color) listingBody.color = color;
      }

      // Attach fashion-specific fields
      if (category === "fashion") {
        if (brand) listingBody.brand = brand;
        if (size) listingBody.size = size;
        if (gender) listingBody.gender = gender;
        if (fabricType) listingBody.fabricType = fabricType;
        if (color) listingBody.color = color;
      }

      // Attach sports-specific fields
      if (category === "sports") {
        if (brand) listingBody.brand = brand;
        if (sportType) listingBody.sportType = sportType;
        if (size) listingBody.size = size;
        if (material) listingBody.material = material;
        if (color) listingBody.color = color;
        if (weight) listingBody.weight = weight;
        if (ageGroup) listingBody.ageGroup = ageGroup;
      }

      // Attach collectible-specific fields
      if (category === "collectibles") {
        if (brand) listingBody.brand = brand;
        if (era) listingBody.era = era;
        if (material) listingBody.material = material;
        if (color) listingBody.color = color;
        if (rarity) listingBody.rarity = rarity;
        if (authenticity) listingBody.authenticity = authenticity;
        if (origin) listingBody.origin = origin;
      }

      // Attach pet-specific fields
      if (category === "pets") {
        if (breed) listingBody.breed = breed;
        if (petAge) listingBody.petAge = petAge;
        if (gender) listingBody.gender = gender;
        if (vaccinated) listingBody.vaccinated = vaccinated;
        if (trained) listingBody.trained = trained;
        if (color) listingBody.color = color;
        if (weight) listingBody.weight = weight;
      }

      // Attach book-specific fields
      if (category === "books") {
        if (author) listingBody.author = author;
        if (isbn) listingBody.isbn = isbn;
        if (publisher) listingBody.publisher = publisher;
        if (edition) listingBody.edition = edition;
        if (language) listingBody.language = language;
        if (pages) listingBody.pages = pages;
      }

      // Attach beauty-specific fields
      if (category === "beauty") {
        if (brand) listingBody.brand = brand;
        if (skinType) listingBody.skinType = skinType;
        if (shade) listingBody.shade = shade;
        if (volume) listingBody.volume = volume;
        if (ingredients) listingBody.ingredients = ingredients;
        if (expiryDate) listingBody.expiryDate = expiryDate;
        if (gender) listingBody.gender = gender;
      }

      // Attach toy-specific fields
      if (category === "toys") {
        if (brand) listingBody.brand = brand;
        if (ageGroup) listingBody.ageGroup = ageGroup;
        if (material) listingBody.material = material;
        if (batteryRequired) listingBody.batteryRequired = batteryRequired;
        if (playMode) listingBody.playMode = playMode;
        if (numberOfPieces) listingBody.numberOfPieces = numberOfPieces;
        if (characterTheme) listingBody.characterTheme = characterTheme;
        if (color) listingBody.color = color;
      }

      // Attach forsale-specific fields (multi-category legacy)
      if (category === "forsale") {
        if (brand) listingBody.brand = brand;
        if (productModel) listingBody.model = productModel;
        if (storage) listingBody.storage = storage;
        if (ram) listingBody.ram = ram;
        if (screenSize) listingBody.screenSize = screenSize;
        if (batteryHealth) listingBody.batteryHealth = batteryHealth;
        if (warranty) listingBody.warranty = warranty;
        if (color) listingBody.color = color;
        if (material) listingBody.material = material;
        if (dimensions) listingBody.dimensions = dimensions;
        if (weight) listingBody.weight = weight;
        if (assemblyRequired) listingBody.assemblyRequired = assemblyRequired;
        if (numberOfPieces) listingBody.numberOfPieces = numberOfPieces;
        if (size) listingBody.size = size;
        if (gender) listingBody.gender = gender;
        if (fabricType) listingBody.fabricType = fabricType;
        if (author) listingBody.author = author;
        if (isbn) listingBody.isbn = isbn;
        if (publisher) listingBody.publisher = publisher;
        if (edition) listingBody.edition = edition;
        if (sportType) listingBody.sportType = sportType;
      }

      console.log("[PostAd] createListing body:", JSON.stringify(listingBody));
      const result = await createListing(category, listingBody);

      dispatch(setSubmitting(false));
      dispatch(resetPostForm());

      // Pass the created listing data to success screen
      const listing = result.listing;
      router.push({
        pathname: "/listing-success",
        params: {
          title: listing?.title ?? title,
          price: String(listing?.price ?? price),
          location: listing?.location ?? location,
          image: listing?.images?.[0] ?? imageUrls[0] ?? "",
          category: categoryConfig?.name ?? category,
        },
      } as Href);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to post listing";
      dispatch(setSubmitError(message));
      dispatch(setSubmitting(false));
      Alert.alert("Error", message);
    }
  };

  return (
    <SellFlowLayout
      step={3}
      title="Photos & publish"
      subtitle="Images, location & contact"
      onBack={handleBack}
      primaryLabel="Post ad"
      onPrimaryPress={handleSubmit}
      primaryDisabled={isSubmitting}
      primaryLoading={isSubmitting}
    >
      <SellSectionCard title="Photos">
        <View className="px-4 py-4">
          <View className="mb-3 flex-row items-center justify-between">
            <Text
              className="text-[13px] text-[#6B7280]"
              style={{ fontFamily: ListifyFonts.regular }}
            >
              Add up to 6 photos
            </Text>
            <Text
              className="text-[12px] text-[#9CA3AF]"
              style={{ fontFamily: ListifyFonts.medium }}
            >
              {imageUris.length} / 6
            </Text>
          </View>

          <View className="flex-row flex-wrap gap-3">
            {imageUris.length < 6 ? (
              <Pressable
                onPress={pickImages}
                className="items-center justify-center rounded-2xl border-2 border-dashed border-[#E5E7EB] bg-[#F9FAFB]"
                style={{ width: 96, height: 96 }}
              >
                <MaterialIcons name="add-a-photo" size={26} color="#9CA3AF" />
                <Text
                  className="mt-1 text-[10px] text-[#6B7280]"
                  style={{ fontFamily: ListifyFonts.medium }}
                >
                  Add
                </Text>
              </Pressable>
            ) : null}

            {imageUris.map((uri, idx) => (
              <View
                key={uri}
                className="overflow-hidden rounded-2xl border border-[#E5E7EB]"
                style={{ width: 96, height: 96 }}
              >
                <Image source={uri} contentFit="cover" className="h-full w-full" />
                <Pressable
                  onPress={() => dispatch(removeImageUri(idx))}
                  className="absolute right-1 top-1 rounded-full bg-white/90 p-1"
                >
                  <MaterialIcons name="close" size={16} color="#DC2626" />
                </Pressable>
              </View>
            ))}
          </View>
          <Text
            className="mt-3 text-[12px] text-[#6B7280]"
            style={{ fontFamily: ListifyFonts.regular }}
          >
            Ads with high-quality photos get 5x more clicks.
          </Text>
        </View>
      </SellSectionCard>

      <SellSectionCard title="Item location">
        <View className="px-4 py-4">
          {/* Google Places Autocomplete */}
          <LocationAutocompleteInput
            value={location}
            onChangeText={(v) => dispatch(setLocation(v))}
            onSelect={async (result) => {
              dispatch(setLocation(result.label));
              if (result.lat != null && result.lng != null) {
                await dispatch(
                  setLocationDirect({
                    label: result.label,
                    lat: result.lat,
                    lng: result.lng,
                  }),
                );
              }
            }}
            placeholder="Neighborhood or city..."
            contained
          />
          <Pressable
            onPress={handleUseCurrentLocation}
            disabled={locationStatus === "loading"}
            className="mt-3 mb-3 flex-row items-center gap-2"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons name="my-location" size={20} color="#1A1A1A" />
            <Text
              className="text-[13px]"
              style={{ fontFamily: ListifyFonts.semiBold, color: "#1A1A1A" }}
            >
              {locationStatus === "loading"
                ? "Detecting location..."
                : "Use my current location"}
            </Text>
          </Pressable>
          <PostLocationMapPreview
            lat={locationCoords.lat}
            lng={locationCoords.lng}
            locationLabel={location}
            height={144}
          />
        </View>
      </SellSectionCard>

      <SellSectionCard title="Contact">
        <View className="px-4 py-4">
          <PhoneInputWithCountry
            phoneCode={phoneCode}
            phone={phone}
            onChangePhoneCode={(code) => dispatch(setPhoneCode(code))}
            onChangePhone={(v) => dispatch(setPhone(v))}
          />
          <View
            className="mt-3 flex-row items-center gap-3 rounded-2xl p-3"
            style={{ backgroundColor: "#F3F4F6" }}
          >
            <MaterialIcons name="verified-user" size={20} color="#6B7280" />
            <Text
              className="flex-1 text-[11px] text-[#374151]"
              style={{ fontFamily: ListifyFonts.regular }}
            >
              We&apos;ll verify this number to prevent spam and keep buyers safe.
            </Text>
          </View>
        </View>
      </SellSectionCard>

      <Text
        className="mb-6 text-center text-[12px] text-[#6B7280]"
        style={{ fontFamily: ListifyFonts.regular }}
      >
        By posting, you agree to Listify&apos;s{" "}
        <Text style={{ fontFamily: ListifyFonts.semiBold, color: "#1A1A1A" }}>
          Terms
        </Text>{" "}
        and{" "}
        <Text style={{ fontFamily: ListifyFonts.semiBold, color: "#1A1A1A" }}>
          Privacy Policy
        </Text>
        .
      </Text>
    </SellFlowLayout>
  );
}
