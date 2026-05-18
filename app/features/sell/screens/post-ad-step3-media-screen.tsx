import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { type Href, useRouter } from "@/lib/safe-router";
import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  addImageUri,
  removeImageUri,
  resetPostForm,
  setLocation,
  setPhone,
  setSubmitError,
  setSubmitting,
  setUploadedImageUrls,
} from "@/store/slices/post-form-slice";

export function PostAdStep3MediaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();

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

  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);

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
    <View className="flex-1 bg-[#F6F7F8]">
      {/* Top Bar */}
      <View
        className="absolute inset-x-0 top-0 z-50 flex-row items-center justify-between border-b border-slate-100 bg-white/90 px-4"
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
            onPress={handleBack}
            className="h-9 w-9 items-center justify-center rounded-full"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons name="arrow-back" size={23} color="#0F172A" />
          </Pressable>
          <View>
            <Text className="text-[18px] font-semibold tracking-tight text-[#0F172A]">
              Step 3 of 3
            </Text>
            <Text className="text-[10px] font-bold uppercase tracking-widest text-[#006B55]">
              Media & Location
            </Text>
          </View>
        </View>
        <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <Text className="text-[12px] font-semibold text-[#27BB97]">
            Preview
          </Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: topBarHeight + 16,
          paddingBottom: 120 + Math.max(insets.bottom, 8),
        }}
      >
        <View className="px-4">
          {/* Photos Section */}
          <View className="mb-8">
            <View className="mb-4 flex-row items-end justify-between">
              <Text className="text-[18px] font-semibold text-[#161D1A]">
                Photos
              </Text>
              <Text className="text-[12px] font-medium text-[#6C7A74]">
                {imageUris.length} / 6 images
              </Text>
            </View>

            <View className="flex-row flex-wrap gap-3">
              {/* Add More */}
              {imageUris.length < 6 && (
              <Pressable
                onPress={pickImages}
                className="items-center justify-center rounded-xl border-2 border-dashed border-[#BBCAC3] bg-[#F3F4F6]"
                style={{ width: 100, height: 100 }}
              >
                <MaterialIcons name="add-a-photo" size={28} color="#6C7A74" />
                <Text className="mt-1 text-[10px] font-medium text-[#6C7A74]">
                  Add More
                </Text>
              </Pressable>
              )}

              {imageUris.map((uri, idx) => (
                <View
                  key={uri}
                  className="overflow-hidden rounded-xl border border-[#BBCAC3]"
                  style={{ width: 100, height: 100 }}
                >
                  <Image
                    source={uri}
                    contentFit="cover"
                    className="h-full w-full"
                  />
                  <Pressable
                    onPress={() => dispatch(removeImageUri(idx))}
                    className="absolute right-1 top-1 rounded-full bg-white/70 p-1"
                  >
                    <MaterialIcons name="close" size={16} color="#BA1A1A" />
                  </Pressable>
                </View>
              ))}
            </View>
            <Text className="mt-2 px-1 text-[12px] text-[#6C7A74]">
              Ads with high-quality photos get 5x more clicks.
            </Text>
          </View>

          {/* Location Section */}
          <View className="mb-8">
            <Text className="mb-4 px-1 text-[12px] font-medium text-[#161D1A]">
              Item Location
            </Text>
            <View className="mb-3 h-12 flex-row items-center rounded-xl border border-[#BBCAC3] bg-white px-4">
              <MaterialIcons name="location-on" size={20} color="#6C7A74" />
              <TextInput
                value={location}
                onChangeText={(v) => dispatch(setLocation(v))}
                placeholder="Search for neighborhood or city..."
                placeholderTextColor="#94A3B8"
                className="ml-2 flex-1 text-[14px] text-[#161D1A]"
                style={{ paddingVertical: 0 }}
              />
            </View>
            <Pressable className="mb-4 flex-row items-center gap-2 px-1 py-1">
              <MaterialIcons name="my-location" size={20} color="#006B55" />
              <Text className="text-[12px] font-medium text-[#006B55]">
                Use Current Location
              </Text>
            </Pressable>

            {/* Map placeholder */}
            <View className="h-40 items-center justify-center overflow-hidden rounded-2xl border border-[#BBCAC3] bg-[#F3F4F6]">
              <MaterialIcons name="map" size={40} color="#6C7A74" />
              <Text className="mt-2 text-[12px] text-[#6C7A74]">
                {location || "Enter location above"}
              </Text>
            </View>
          </View>

          {/* Contact Details */}
          <View className="mb-8">
            <Text className="mb-4 px-1 text-[12px] font-medium text-[#161D1A]">
              Contact Details
            </Text>
            <View className="flex-row gap-2">
              <View className="h-12 w-24 items-center justify-center rounded-xl border border-[#BBCAC3] bg-white px-3">
                <Text className="text-[14px] text-[#161D1A]">{phoneCode}</Text>
              </View>
              <View className="h-12 flex-1 flex-row items-center rounded-xl border border-[#BBCAC3] bg-white px-4">
                <MaterialIcons name="call" size={20} color="#6C7A74" />
                <TextInput
                  value={phone}
                  onChangeText={(v) => dispatch(setPhone(v))}
                  placeholder="Mobile number"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                  className="ml-2 flex-1 text-[14px] text-[#161D1A]"
                  style={{ paddingVertical: 0 }}
                />
              </View>
            </View>
            <View className="mt-3 flex-row items-center gap-3 rounded-xl border border-[rgba(39,187,151,0.2)] bg-[rgba(39,187,151,0.1)] p-4">
              <MaterialIcons name="verified-user" size={22} color="#006B55" />
              <Text className="flex-1 text-[11px] font-medium text-[#004535]">
                We'll send a verification code to this number to prevent spam
                and ensure trust.
              </Text>
            </View>
          </View>

          {/* Policy */}
          <Text className="mb-4 text-center text-[12px] text-[#6C7A74]">
            By clicking "Post Ad Now", you agree to Listify's{" "}
            <Text className="font-semibold text-[#006B55]">Terms of Use</Text>{" "}
            and{" "}
            <Text className="font-semibold text-[#006B55]">Privacy Policy</Text>
            .
          </Text>
        </View>
      </ScrollView>

      {/* Footer CTA */}
      <View
        className="absolute inset-x-0 bottom-0 z-50 border-t border-slate-100 bg-white/90 px-4 py-4"
        style={{
          paddingBottom: Math.max(insets.bottom, 16),
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 20,
          elevation: 8,
        }}
      >
        <Pressable
          onPress={handleSubmit}
          disabled={isSubmitting}
          className="overflow-hidden rounded-2xl"
          style={({ pressed }) => ({
            transform: [{ scale: pressed ? 0.98 : 1 }],
            opacity: isSubmitting ? 0.7 : 1,
          })}
        >
          <LinearGradient
            colors={["#27BB97", "#1E9E7E"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{
              height: 56,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text className="text-[20px] font-semibold text-white">
                  Post Ad Now
                </Text>
                <MaterialIcons name="rocket-launch" size={22} color="#FFFFFF" />
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}
