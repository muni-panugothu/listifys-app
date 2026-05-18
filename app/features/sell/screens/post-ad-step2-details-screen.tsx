import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "@/lib/safe-router";
import { useCallback, useMemo } from "react";
import { BackHandler, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  CONDITION_OPTIONS,
  CONDITION_SKIP_CATEGORIES,
  PRICE_OPTIONAL_CATEGORIES,
} from "@/constants/categories";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  setTitle, setDescription, setPrice, setCondition, setListingType,
  // Property
  setBedrooms, setBathrooms, setFurnishing, setSquareFeet, toggleFeature, setPetFriendly, setGenderPreference, setOccupancy,
  // Electronics
  setBrand, setModel, setWarranty, setPurchaseYear, setScreenSize, setDisplayType,
  setProcessor, setRam, setStorage, setCapacity, setEnergyRating, setMegapixels, setLensType,
  // Vehicles
  setVariant, setYear, setKmDriven, setFuelType, setTransmission, setOwnership, setColor,
  setEngineCC, setCycleType, setGearCount, setFrameSize, setCompatibleVehicle, setPartCategory,
  // Jobs
  setCompanyName, setCompanyEmail, setApplyLink, setJobType, setExperience, setEducation,
  setEmploymentType, setWorkMode, setSalaryMin, setSalaryMax, setSalaryType,
  setIndustry, setPositions,
  // TakeCare
  setAvailability, setAge, toggleLanguage, toggleCertification,
  // Events
  setEventDate, setEventTime, setOrganizer, setVenue, setTicketsAvailable, setAgeRestriction, setDressCode,
  // Mobiles
  setBatteryHealth,
  // Furniture
  setMaterial, setDimensions, setWeight, setAssemblyRequired, setNumberOfPieces,
  // Fashion
  setSize, setGender, setFabricType,
  // Sports
  setSportType, setAgeGroup,
  // Collectibles
  setEra, setRarity, setAuthenticity, setOrigin,
  // Pets
  setBreed, setPetAge, setVaccinated, setTrained,
  // Books
  setAuthor, setIsbn, setPublisher, setEdition, setLanguage, setPages,
  // Beauty
  setSkinType, setShade, setVolume, setIngredients, setExpiryDate,
  // Toys
  setBatteryRequired, setPlayMode, setCharacterTheme,
} from "@/store/slices/post-form-slice";

// ── Option constants ────────────────────────────────────────────────────────────
const FURNISHING_OPTIONS = ["Fully Furnished", "Semi-Furnished", "Unfurnished"];
const PROPERTY_AMENITIES = [
  "Parking", "Swimming Pool", "Gym", "Power Backup", "Lift",
  "Security", "Garden", "Clubhouse", "Play Area", "Water Supply",
  "Gas Pipeline", "CCTV", "Intercom", "Fire Safety",
];
const GENDER_PREF_OPTIONS = ["Any", "Male Only", "Female Only"];
const OCCUPANCY_OPTIONS = ["Single", "Shared", "Any"];

const WARRANTY_OPTIONS = ["Under Warranty", "Expired", "No Warranty"];
const ENERGY_RATING_OPTIONS = ["1 Star", "2 Star", "3 Star", "4 Star", "5 Star"];
const TV_AUDIO_SUBCATEGORIES = ["TVs, Video - Audio", "Hard Disks, Printers & Monitors"];
const COMPUTER_SUBCATEGORIES = ["Computers & Laptops", "Computer Accessories", "Hard Disks, Printers & Monitors"];
const APPLIANCE_SUBCATEGORIES = ["Kitchen & Other Appliances", "Fridges", "Washing Machines", "ACs"];
const CAMERA_SUBCATEGORIES = ["Cameras & Lenses"];

const FUEL_OPTIONS = ["Petrol", "Diesel", "CNG", "Electric", "Hybrid", "LPG"];
const TRANSMISSION_OPTIONS = ["Manual", "Automatic"];
const OWNERSHIP_OPTIONS = ["1st Owner", "2nd Owner", "3rd Owner", "4th+ Owner"];
const CYCLE_TYPE_OPTIONS = ["Mountain", "Road", "Hybrid", "BMX", "Kids", "Folding", "Electric", "Cruiser"];
const COMPATIBLE_VEHICLE_OPTIONS = ["Car", "Bike", "Cycle", "Universal"];
const PART_CATEGORY_OPTIONS = ["Engine Parts", "Body Parts", "Electrical", "Suspension", "Brakes", "Tyres & Wheels", "Interior", "Exterior", "Exhaust", "Filters", "Other"];

const SALARY_TYPE_OPTIONS = ["monthly", "yearly", "hourly", "daily", "weekly"];
const EMPLOYMENT_TYPE_OPTIONS = ["Full Time", "Part Time", "Contract", "Freelance", "Internship"];
const WORK_MODE_OPTIONS = ["On-site", "Remote", "Hybrid"];

const TAKECARE_LANGUAGES = ["English", "Hindi", "Telugu", "Tamil", "Kannada", "Malayalam", "Bengali", "Marathi", "Gujarati", "Punjabi"];
const TAKECARE_CERTS = ["First Aid", "CPR", "Nursing", "Child Care", "Elder Care", "Pet Grooming"];

const ASSEMBLY_OPTIONS = ["Yes", "No"];
const FASHION_GENDER_OPTIONS = ["Men", "Women", "Kids", "Unisex"];
const SPORT_TYPE_OPTIONS = ["Cricket", "Football", "Badminton", "Tennis", "Basketball", "Swimming", "Running", "Yoga", "Boxing", "Hockey", "Table Tennis", "Gym & Fitness", "Cycling", "Hiking", "Other"];
const AGE_GROUP_OPTIONS = ["Kids", "Adults", "All Ages"];
const RARITY_OPTIONS = ["Common", "Uncommon", "Rare", "Very Rare", "Extremely Rare"];
const AUTHENTICITY_OPTIONS = ["Certified", "Uncertified"];
const PET_GENDER_OPTIONS = ["Male", "Female", "Unknown"];
const VACCINATED_OPTIONS = ["Yes", "No", "Partial"];
const TRAINED_OPTIONS = ["Yes", "No", "Partial"];
const SKIN_TYPE_OPTIONS = ["All", "Oily", "Dry", "Combination", "Sensitive", "Normal"];
const BEAUTY_GENDER_OPTIONS = ["Men", "Women", "Unisex"];
const BATTERY_REQUIRED_OPTIONS = ["Yes", "No", "Not Sure"];

// ── Helpers ─────────────────────────────────────────────────────────────────────

/** Pill selector row */
function PillRow({ options, value, onSelect }: { options: string[]; value: string; onSelect: (v: string) => void }) {
  return (
    <View className="flex-row flex-wrap gap-3">
      {options.map((opt) => {
        const isActive = value === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => onSelect(isActive ? "" : opt)}
            className="rounded-full px-5 py-2.5"
            style={{
              backgroundColor: isActive ? "#27BB97" : "#FFFFFF",
              borderWidth: 1,
              borderColor: isActive ? "#27BB97" : "#E2E8F0",
            }}
          >
            <Text className="text-[12px] font-medium" style={{ color: isActive ? "#FFFFFF" : "#161D1A" }}>
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Multi-select chip row */
function ChipRow({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((item) => {
        const isActive = selected.includes(item);
        return (
          <Pressable
            key={item}
            onPress={() => onToggle(item)}
            className="flex-row items-center gap-1.5 rounded-full px-4 py-2"
            style={{
              backgroundColor: isActive ? "rgba(39,187,151,0.1)" : "#FFFFFF",
              borderWidth: 1,
              borderColor: isActive ? "#27BB97" : "#E2E8F0",
            }}
          >
            <MaterialIcons
              name={isActive ? "check-circle" : "add-circle-outline"}
              size={16}
              color={isActive ? "#27BB97" : "#94A3B8"}
            />
            <Text className="text-[12px] font-medium" style={{ color: isActive ? "#006B55" : "#161D1A" }}>
              {item}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Text input field with icon */
function IconField({ icon, value, onChangeText, placeholder, numeric, maxLength }: {
  icon: React.ComponentProps<typeof MaterialIcons>["name"];
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  numeric?: boolean;
  maxLength?: number;
}) {
  return (
    <View className="h-12 flex-row items-center rounded-lg border border-slate-200 bg-white px-4">
      <MaterialIcons name={icon} size={20} color="#6C7A74" />
      <TextInput
        value={value}
        onChangeText={numeric ? (v) => onChangeText(v.replace(/[^0-9]/g, "")) : onChangeText}
        keyboardType={numeric ? "numeric" : "default"}
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        className="ml-2 flex-1 text-[14px] text-[#161D1A]"
        style={{ paddingVertical: 0 }}
      />
    </View>
  );
}

/** Section label */
function Label({ text }: { text: string }) {
  return <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">{text}</Text>;
}
function LabelPill({ text }: { text: string }) {
  return <Text className="mb-3 text-[12px] font-medium text-[#161D1A]">{text}</Text>;
}

// ── Main Screen ─────────────────────────────────────────────────────────────────

export function PostAdStep2DetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();

  const pf = useAppSelector((s) => s.postForm);
  const {
    title, description, price, condition, category, subcategory, listingType,
    bedrooms, bathrooms, furnishing, squareFeet, features, petFriendly, genderPreference, occupancy,
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
  } = pf;

  const isProperty = category === "properties";
  const isElectronics = category === "electronics";
  const isVehicle = category === "vehicles";
  const isJob = category === "jobs";
  const isTakeCare = category === "takecare";
  const isEvent = category === "events";
  const isMobile = category === "mobiles";
  const isFurniture = category === "furniture";
  const isFashion = category === "fashion";
  const isSports = category === "sports";
  const isCollectible = category === "collectibles";
  const isPet = category === "pets";
  const isBook = category === "books";
  const isBeauty = category === "beauty";
  const isToy = category === "toys";
  const isForSale = category === "forsale";

  // Electronics subcategory-specific
  const showTvFields = isElectronics && TV_AUDIO_SUBCATEGORIES.includes(subcategory);
  const showComputerFields = isElectronics && COMPUTER_SUBCATEGORIES.includes(subcategory);
  const showApplianceFields = isElectronics && APPLIANCE_SUBCATEGORIES.includes(subcategory);
  const showCameraFields = isElectronics && CAMERA_SUBCATEGORIES.includes(subcategory);

  // Vehicle subcategory-specific
  const isCar = isVehicle && subcategory === "Cars";
  const isBike = isVehicle && subcategory === "Bikes";
  const isCycle = isVehicle && subcategory === "Cycle";
  const isSparePart = isVehicle && subcategory === "Spare Parts";

  const showCondition = !CONDITION_SKIP_CATEGORIES.includes(category);
  const priceOptional = PRICE_OPTIONAL_CATEGORIES.includes(category);

  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);
  const priceError =
    !priceOptional && price.length > 0 && (Number(price) <= 100 || Number(price) === 0);

  const handleBack = () => {
    router.replace({
      pathname: "/post-ad-step1-category",
      params: { category },
    } as Href);
  };

  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        handleBack();
        return true;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onHardwareBack);
      return () => sub.remove();
    }, [router, category]),
  );

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
          <Text className="text-[18px] font-semibold tracking-tight text-[#0F172A]">
            Step 2 of 3
          </Text>
        </View>
        <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <Text className="text-[12px] font-semibold text-[#27BB97]">Save as Draft</Text>
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
          {/* Progress Bar */}
          <View className="mb-6 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <View className="h-full w-2/3 rounded-full bg-[#27BB97]" />
          </View>

          {/* Header */}
          <View className="mb-6">
            <Text className="text-[24px] font-bold tracking-tight text-[#0F172A]">Listing Details</Text>
            <Text className="mt-1 text-[14px] text-[#6C7A74]">
              Provide accurate details to help buyers find your item.
            </Text>
          </View>

          {/* Property Listing Type */}
          {isProperty && (
            <View className="mb-6">
              <Label text="Listing Type" />
              <View className="rounded-xl bg-[#E9EFEB] p-1 flex-row">
                {["Properties", "Rentals"].map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => dispatch(setListingType(t))}
                    className="flex-1 rounded-lg py-2.5"
                    style={{
                      backgroundColor: listingType === t ? "#FFFFFF" : "transparent",
                      shadowColor: listingType === t ? "#000" : "transparent",
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: listingType === t ? 0.08 : 0,
                      shadowRadius: 2,
                      elevation: listingType === t ? 1 : 0,
                    }}
                  >
                    <Text className="text-center text-[14px] font-semibold" style={{ color: listingType === t ? "#006B55" : "#6C7A74" }}>
                      {t === "Properties" ? "For Sale" : "For Rent"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* ── Ad Title ── */}
          <View className="mb-6">
            <View className="mb-2 flex-row items-end justify-between">
              <Label text="Ad Title" />
              <Text className="text-[10px] font-medium text-[#6C7A74]">{title.length}/70</Text>
            </View>
            <TextInput
              value={title}
              onChangeText={(v) => dispatch(setTitle(v))}
              maxLength={70}
              placeholder="e.g. iPhone 13 Pro Max with box"
              placeholderTextColor="#94A3B8"
              className="h-12 rounded-lg border border-slate-200 bg-white px-4 text-[14px] text-[#161D1A]"
              style={{ paddingVertical: 0 }}
            />
          </View>

          {/* ── Description ── */}
          <View className="mb-6">
            <Label text="Description" />
            <TextInput
              value={description}
              onChangeText={(v) => dispatch(setDescription(v))}
              placeholder="Describe what you're selling, including features and any flaws..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className="min-h-30 rounded-lg border border-slate-200 bg-white p-4 text-[14px] text-[#161D1A]"
            />
            <Text className="mt-1 px-1 text-[11px] text-[#6C7A74]">
              Mention key selling points like brand, age, and condition details.
            </Text>
          </View>

          {!priceOptional && (
            <View className="mb-6">
              <Label text="Price" />
              <View
                className="h-12 flex-row items-center rounded-lg bg-white px-4"
                style={{ borderWidth: 1, borderColor: priceError ? "#BA1A1A" : "#E2E8F0" }}
              >
                <Text className="mr-1 text-[16px] font-semibold text-[#161D1A]">₹</Text>
                <TextInput
                  value={price}
                  onChangeText={(v) => dispatch(setPrice(v))}
                  keyboardType="numeric"
                  className="flex-1 text-[16px] font-bold text-[#161D1A]"
                  style={{ paddingVertical: 0, color: priceError ? "#BA1A1A" : "#161D1A" }}
                />
              </View>
              {priceError && (
                <View className="mt-1 flex-row items-center gap-1 px-1">
                  <MaterialIcons name="error" size={14} color="#BA1A1A" />
                  <Text className="text-[11px] text-[#BA1A1A]">Price must be greater than ₹100</Text>
                </View>
              )}
            </View>
          )}

          {/* ── Condition ── */}
          {showCondition && (
            <View className="mb-8">
              <LabelPill text="Condition" />
              <PillRow options={[...CONDITION_OPTIONS]} value={condition} onSelect={(v) => dispatch(setCondition(v || "Good"))} />
            </View>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              PROPERTY FIELDS
             ═══════════════════════════════════════════════════════════════ */}
          {isProperty && (
            <>
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Label text="Bedrooms" />
                  <IconField icon="bed" value={bedrooms} onChangeText={(v) => dispatch(setBedrooms(v))} placeholder="0" numeric />
                </View>
                <View className="flex-1">
                  <Label text="Bathrooms" />
                  <IconField icon="bathtub" value={bathrooms} onChangeText={(v) => dispatch(setBathrooms(v))} placeholder="0" numeric />
                </View>
              </View>
              <View className="mb-6">
                <Label text="Area (sq.ft)" />
                <IconField icon="square-foot" value={squareFeet} onChangeText={(v) => dispatch(setSquareFeet(v))} placeholder="e.g. 1200" numeric />
              </View>
              <View className="mb-6">
                <LabelPill text="Furnishing" />
                <PillRow options={FURNISHING_OPTIONS} value={furnishing} onSelect={(v) => dispatch(setFurnishing(v))} />
              </View>
              <View className="mb-6">
                <LabelPill text="Pet Friendly" />
                <View className="flex-row gap-3">
                  {[true, false].map((val) => {
                    const isActive = petFriendly === val;
                    return (
                      <Pressable
                        key={String(val)}
                        onPress={() => dispatch(setPetFriendly(val))}
                        className="rounded-full px-6 py-2.5"
                        style={{ backgroundColor: isActive ? "#27BB97" : "#FFFFFF", borderWidth: 1, borderColor: isActive ? "#27BB97" : "#E2E8F0" }}
                      >
                        <Text className="text-[12px] font-medium" style={{ color: isActive ? "#FFFFFF" : "#161D1A" }}>
                          {val ? "Yes" : "No"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View className="mb-6">
                <LabelPill text="Gender Preference" />
                <PillRow options={GENDER_PREF_OPTIONS} value={genderPreference} onSelect={(v) => dispatch(setGenderPreference(v))} />
              </View>
              <View className="mb-6">
                <LabelPill text="Occupancy" />
                <PillRow options={OCCUPANCY_OPTIONS} value={occupancy} onSelect={(v) => dispatch(setOccupancy(v))} />
              </View>
              <View className="mb-8">
                <LabelPill text="Amenities" />
                <ChipRow options={PROPERTY_AMENITIES} selected={features} onToggle={(v) => dispatch(toggleFeature(v))} />
              </View>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              ELECTRONICS FIELDS
             ═══════════════════════════════════════════════════════════════ */}
          {isElectronics && (
            <>
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Label text="Brand" />
                  <IconField icon="branding-watermark" value={brand} onChangeText={(v) => dispatch(setBrand(v))} placeholder="e.g. Samsung" />
                </View>
                <View className="flex-1">
                  <Label text="Model" />
                  <IconField icon="info-outline" value={productModel} onChangeText={(v) => dispatch(setModel(v))} placeholder="e.g. Galaxy S24" />
                </View>
              </View>
              <View className="mb-6">
                <Label text="Purchase Year" />
                <IconField icon="date-range" value={purchaseYear} onChangeText={(v) => dispatch(setPurchaseYear(v))} placeholder="e.g. 2023" numeric maxLength={4} />
              </View>
              <View className="mb-6">
                <LabelPill text="Warranty" />
                <PillRow options={WARRANTY_OPTIONS} value={warranty} onSelect={(v) => dispatch(setWarranty(v))} />
              </View>
              {showTvFields && (
                <View className="mb-6 flex-row gap-4">
                  <View className="flex-1">
                    <Label text="Screen Size" />
                    <IconField icon="tv" value={screenSize} onChangeText={(v) => dispatch(setScreenSize(v))} placeholder='e.g. 55"' />
                  </View>
                  <View className="flex-1">
                    <Label text="Display Type" />
                    <IconField icon="hd" value={displayType} onChangeText={(v) => dispatch(setDisplayType(v))} placeholder="e.g. OLED" />
                  </View>
                </View>
              )}
              {showComputerFields && (
                <>
                  <View className="mb-6">
                    <Label text="Processor" />
                    <IconField icon="memory" value={processor} onChangeText={(v) => dispatch(setProcessor(v))} placeholder="e.g. Intel i7 12th Gen" />
                  </View>
                  <View className="mb-6 flex-row gap-4">
                    <View className="flex-1">
                      <Label text="RAM" />
                      <IconField icon="developer-board" value={ram} onChangeText={(v) => dispatch(setRam(v))} placeholder="e.g. 16 GB" />
                    </View>
                    <View className="flex-1">
                      <Label text="Storage" />
                      <IconField icon="sd-storage" value={storage} onChangeText={(v) => dispatch(setStorage(v))} placeholder="e.g. 512 GB SSD" />
                    </View>
                  </View>
                </>
              )}
              {showApplianceFields && (
                <>
                  <View className="mb-6">
                    <Label text="Capacity" />
                    <IconField icon="straighten" value={capacity} onChangeText={(v) => dispatch(setCapacity(v))} placeholder="e.g. 260L / 7kg / 1.5 Ton" />
                  </View>
                  <View className="mb-6">
                    <LabelPill text="Energy Rating" />
                    <PillRow options={ENERGY_RATING_OPTIONS} value={energyRating} onSelect={(v) => dispatch(setEnergyRating(v))} />
                  </View>
                </>
              )}
              {showCameraFields && (
                <View className="mb-6 flex-row gap-4">
                  <View className="flex-1">
                    <Label text="Megapixels" />
                    <IconField icon="camera-alt" value={megapixels} onChangeText={(v) => dispatch(setMegapixels(v))} placeholder="e.g. 50 MP" />
                  </View>
                  <View className="flex-1">
                    <Label text="Lens Type" />
                    <IconField icon="camera" value={lensType} onChangeText={(v) => dispatch(setLensType(v))} placeholder="e.g. Wide Angle" />
                  </View>
                </View>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              VEHICLES FIELDS
             ═══════════════════════════════════════════════════════════════ */}
          {isVehicle && (
            <>
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Label text="Brand" />
                  <IconField icon="branding-watermark" value={brand} onChangeText={(v) => dispatch(setBrand(v))} placeholder="e.g. Honda" />
                </View>
                <View className="flex-1">
                  <Label text="Model" />
                  <IconField icon="info-outline" value={productModel} onChangeText={(v) => dispatch(setModel(v))} placeholder="e.g. City" />
                </View>
              </View>
              {(isCar || isBike) && (
                <>
                  <View className="mb-6">
                    <Label text="Variant" />
                    <IconField icon="tune" value={variant} onChangeText={(v) => dispatch(setVariant(v))} placeholder="e.g. VX CVT" />
                  </View>
                  <View className="mb-6 flex-row gap-4">
                    <View className="flex-1">
                      <Label text="Year" />
                      <IconField icon="date-range" value={year} onChangeText={(v) => dispatch(setYear(v))} placeholder="e.g. 2022" numeric maxLength={4} />
                    </View>
                    <View className="flex-1">
                      <Label text="KM Driven" />
                      <IconField icon="speed" value={kmDriven} onChangeText={(v) => dispatch(setKmDriven(v))} placeholder="e.g. 25000" />
                    </View>
                  </View>
                  <View className="mb-6">
                    <LabelPill text="Fuel Type" />
                    <PillRow options={FUEL_OPTIONS} value={fuelType} onSelect={(v) => dispatch(setFuelType(v))} />
                  </View>
                  <View className="mb-6">
                    <LabelPill text="Transmission" />
                    <PillRow options={TRANSMISSION_OPTIONS} value={transmission} onSelect={(v) => dispatch(setTransmission(v))} />
                  </View>
                  <View className="mb-6">
                    <LabelPill text="Ownership" />
                    <PillRow options={OWNERSHIP_OPTIONS} value={ownership} onSelect={(v) => dispatch(setOwnership(v))} />
                  </View>
                  <View className="mb-6">
                    <Label text="Color" />
                    <IconField icon="palette" value={color} onChangeText={(v) => dispatch(setColor(v))} placeholder="e.g. White" />
                  </View>
                </>
              )}
              {isBike && (
                <View className="mb-6">
                  <Label text="Engine CC" />
                  <IconField icon="settings" value={engineCC} onChangeText={(v) => dispatch(setEngineCC(v))} placeholder="e.g. 150" />
                </View>
              )}
              {isCycle && (
                <>
                  <View className="mb-6">
                    <LabelPill text="Cycle Type" />
                    <PillRow options={CYCLE_TYPE_OPTIONS} value={cycleType} onSelect={(v) => dispatch(setCycleType(v))} />
                  </View>
                  <View className="mb-6 flex-row gap-4">
                    <View className="flex-1">
                      <Label text="Gear Count" />
                      <IconField icon="settings" value={gearCount} onChangeText={(v) => dispatch(setGearCount(v))} placeholder="e.g. 21" />
                    </View>
                    <View className="flex-1">
                      <Label text="Frame Size" />
                      <IconField icon="straighten" value={frameSize} onChangeText={(v) => dispatch(setFrameSize(v))} placeholder='e.g. 18"' />
                    </View>
                  </View>
                  <View className="mb-6">
                    <Label text="Color" />
                    <IconField icon="palette" value={color} onChangeText={(v) => dispatch(setColor(v))} placeholder="e.g. Red" />
                  </View>
                </>
              )}
              {isSparePart && (
                <>
                  <View className="mb-6">
                    <LabelPill text="Compatible Vehicle" />
                    <PillRow options={COMPATIBLE_VEHICLE_OPTIONS} value={compatibleVehicle} onSelect={(v) => dispatch(setCompatibleVehicle(v))} />
                  </View>
                  <View className="mb-6">
                    <LabelPill text="Part Category" />
                    <PillRow options={PART_CATEGORY_OPTIONS} value={partCategory} onSelect={(v) => dispatch(setPartCategory(v))} />
                  </View>
                </>
              )}
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              JOBS FIELDS
             ═══════════════════════════════════════════════════════════════ */}
          {isJob && (
            <>
              <View className="mb-6">
                <Label text="Company Name" />
                <IconField icon="business" value={companyName} onChangeText={(v) => dispatch(setCompanyName(v))} placeholder="e.g. Infosys" />
              </View>
              <View className="mb-6">
                <Label text="Company Email" />
                <IconField icon="email" value={companyEmail} onChangeText={(v) => dispatch(setCompanyEmail(v))} placeholder="e.g. hr@company.com" />
              </View>
              <View className="mb-6">
                <Label text="Apply Link" />
                <IconField icon="link" value={applyLink} onChangeText={(v) => dispatch(setApplyLink(v))} placeholder="https://careers.company.com" />
              </View>
              <View className="mb-6">
                <Label text="Job Type" />
                <IconField icon="work-outline" value={jobType} onChangeText={(v) => dispatch(setJobType(v))} placeholder="e.g. Software Engineer" />
              </View>
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Label text="Experience" />
                  <IconField icon="trending-up" value={experience} onChangeText={(v) => dispatch(setExperience(v))} placeholder="e.g. 2-4 years" />
                </View>
                <View className="flex-1">
                  <Label text="Education" />
                  <IconField icon="school" value={education} onChangeText={(v) => dispatch(setEducation(v))} placeholder="e.g. B.Tech" />
                </View>
              </View>
              <View className="mb-6">
                <LabelPill text="Employment Type" />
                <PillRow options={EMPLOYMENT_TYPE_OPTIONS} value={employmentType} onSelect={(v) => dispatch(setEmploymentType(v))} />
              </View>
              <View className="mb-6">
                <LabelPill text="Work Mode" />
                <PillRow options={WORK_MODE_OPTIONS} value={workMode} onSelect={(v) => dispatch(setWorkMode(v))} />
              </View>
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Label text="Salary Min" />
                  <IconField icon="attach-money" value={salaryMin} onChangeText={(v) => dispatch(setSalaryMin(v))} placeholder="e.g. 30000" numeric />
                </View>
                <View className="flex-1">
                  <Label text="Salary Max" />
                  <IconField icon="attach-money" value={salaryMax} onChangeText={(v) => dispatch(setSalaryMax(v))} placeholder="e.g. 60000" numeric />
                </View>
              </View>
              <View className="mb-6">
                <LabelPill text="Salary Type" />
                <PillRow options={SALARY_TYPE_OPTIONS} value={salaryType} onSelect={(v) => dispatch(setSalaryType(v))} />
              </View>
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Label text="Industry" />
                  <IconField icon="domain" value={industry} onChangeText={(v) => dispatch(setIndustry(v))} placeholder="e.g. IT" />
                </View>
                <View className="flex-1">
                  <Label text="Positions" />
                  <IconField icon="group" value={positions} onChangeText={(v) => dispatch(setPositions(v))} placeholder="e.g. 5" numeric />
                </View>
              </View>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              TAKECARE FIELDS
             ═══════════════════════════════════════════════════════════════ */}
          {isTakeCare && (
            <>
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Label text="Experience" />
                  <IconField icon="trending-up" value={experience} onChangeText={(v) => dispatch(setExperience(v))} placeholder="e.g. 3 years" />
                </View>
                <View className="flex-1">
                  <Label text="Availability" />
                  <IconField icon="schedule" value={availability} onChangeText={(v) => dispatch(setAvailability(v))} placeholder="e.g. Full Time" />
                </View>
              </View>
              <View className="mb-6">
                <Label text="Age" />
                <IconField icon="person" value={age} onChangeText={(v) => dispatch(setAge(v))} placeholder="e.g. 30" numeric />
              </View>
              <View className="mb-6">
                <LabelPill text="Languages" />
                <ChipRow options={TAKECARE_LANGUAGES} selected={languages} onToggle={(v) => dispatch(toggleLanguage(v))} />
              </View>
              <View className="mb-8">
                <LabelPill text="Certifications" />
                <ChipRow options={TAKECARE_CERTS} selected={certifications} onToggle={(v) => dispatch(toggleCertification(v))} />
              </View>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              EVENTS FIELDS
             ═══════════════════════════════════════════════════════════════ */}
          {isEvent && (
            <>
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Label text="Event Date" />
                  <IconField icon="event" value={eventDate} onChangeText={(v) => dispatch(setEventDate(v))} placeholder="e.g. 25 Dec 2025" />
                </View>
                <View className="flex-1">
                  <Label text="Event Time" />
                  <IconField icon="access-time" value={eventTime} onChangeText={(v) => dispatch(setEventTime(v))} placeholder="e.g. 7:00 PM" />
                </View>
              </View>
              <View className="mb-6">
                <Label text="Organizer" />
                <IconField icon="person" value={organizer} onChangeText={(v) => dispatch(setOrganizer(v))} placeholder="e.g. EventBrite Inc." />
              </View>
              <View className="mb-6">
                <Label text="Venue" />
                <IconField icon="place" value={venue} onChangeText={(v) => dispatch(setVenue(v))} placeholder="e.g. HICC, Hyderabad" />
              </View>
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Label text="Tickets Available" />
                  <IconField icon="confirmation-number" value={ticketsAvailable} onChangeText={(v) => dispatch(setTicketsAvailable(v))} placeholder="e.g. 500" numeric />
                </View>
                <View className="flex-1">
                  <Label text="Age Restriction" />
                  <IconField icon="no-accounts" value={ageRestriction} onChangeText={(v) => dispatch(setAgeRestriction(v))} placeholder="e.g. 18+" />
                </View>
              </View>
              <View className="mb-6">
                <Label text="Dress Code" />
                <IconField icon="checkroom" value={dressCode} onChangeText={(v) => dispatch(setDressCode(v))} placeholder="e.g. Formal" />
              </View>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              MOBILES FIELDS
             ═══════════════════════════════════════════════════════════════ */}
          {isMobile && (
            <>
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Label text="Brand" />
                  <IconField icon="branding-watermark" value={brand} onChangeText={(v) => dispatch(setBrand(v))} placeholder="e.g. Apple" />
                </View>
                <View className="flex-1">
                  <Label text="Model" />
                  <IconField icon="info-outline" value={productModel} onChangeText={(v) => dispatch(setModel(v))} placeholder="e.g. iPhone 15" />
                </View>
              </View>
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Label text="Storage" />
                  <IconField icon="sd-storage" value={storage} onChangeText={(v) => dispatch(setStorage(v))} placeholder="e.g. 128 GB" />
                </View>
                <View className="flex-1">
                  <Label text="RAM" />
                  <IconField icon="developer-board" value={ram} onChangeText={(v) => dispatch(setRam(v))} placeholder="e.g. 6 GB" />
                </View>
              </View>
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Label text="Screen Size" />
                  <IconField icon="smartphone" value={screenSize} onChangeText={(v) => dispatch(setScreenSize(v))} placeholder='e.g. 6.1"' />
                </View>
                <View className="flex-1">
                  <Label text="Battery Health" />
                  <IconField icon="battery-full" value={batteryHealth} onChangeText={(v) => dispatch(setBatteryHealth(v))} placeholder="e.g. 92%" />
                </View>
              </View>
              <View className="mb-6">
                <LabelPill text="Warranty" />
                <PillRow options={WARRANTY_OPTIONS} value={warranty} onSelect={(v) => dispatch(setWarranty(v))} />
              </View>
              <View className="mb-6">
                <Label text="Color" />
                <IconField icon="palette" value={color} onChangeText={(v) => dispatch(setColor(v))} placeholder="e.g. Space Black" />
              </View>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              FURNITURE FIELDS
             ═══════════════════════════════════════════════════════════════ */}
          {isFurniture && (
            <>
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Label text="Material" />
                  <IconField icon="layers" value={material} onChangeText={(v) => dispatch(setMaterial(v))} placeholder="e.g. Teak Wood" />
                </View>
                <View className="flex-1">
                  <Label text="Color" />
                  <IconField icon="palette" value={color} onChangeText={(v) => dispatch(setColor(v))} placeholder="e.g. Brown" />
                </View>
              </View>
              <View className="mb-6">
                <Label text="Dimensions" />
                <IconField icon="straighten" value={dimensions} onChangeText={(v) => dispatch(setDimensions(v))} placeholder="e.g. 6x4x3 ft" />
              </View>
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Label text="Weight" />
                  <IconField icon="fitness-center" value={weight} onChangeText={(v) => dispatch(setWeight(v))} placeholder="e.g. 25 kg" />
                </View>
                <View className="flex-1">
                  <Label text="No. of Pieces" />
                  <IconField icon="format-list-numbered" value={numberOfPieces} onChangeText={(v) => dispatch(setNumberOfPieces(v))} placeholder="e.g. 3" />
                </View>
              </View>
              <View className="mb-6">
                <LabelPill text="Assembly Required" />
                <PillRow options={ASSEMBLY_OPTIONS} value={assemblyRequired} onSelect={(v) => dispatch(setAssemblyRequired(v))} />
              </View>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              FASHION FIELDS
             ═══════════════════════════════════════════════════════════════ */}
          {isFashion && (
            <>
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Label text="Brand" />
                  <IconField icon="branding-watermark" value={brand} onChangeText={(v) => dispatch(setBrand(v))} placeholder="e.g. Nike" />
                </View>
                <View className="flex-1">
                  <Label text="Size" />
                  <IconField icon="straighten" value={size} onChangeText={(v) => dispatch(setSize(v))} placeholder="e.g. M / 42" />
                </View>
              </View>
              <View className="mb-6">
                <LabelPill text="Gender" />
                <PillRow options={FASHION_GENDER_OPTIONS} value={gender} onSelect={(v) => dispatch(setGender(v))} />
              </View>
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Label text="Fabric Type" />
                  <IconField icon="layers" value={fabricType} onChangeText={(v) => dispatch(setFabricType(v))} placeholder="e.g. Cotton" />
                </View>
                <View className="flex-1">
                  <Label text="Color" />
                  <IconField icon="palette" value={color} onChangeText={(v) => dispatch(setColor(v))} placeholder="e.g. Blue" />
                </View>
              </View>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              SPORTS FIELDS
             ═══════════════════════════════════════════════════════════════ */}
          {isSports && (
            <>
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Label text="Brand" />
                  <IconField icon="branding-watermark" value={brand} onChangeText={(v) => dispatch(setBrand(v))} placeholder="e.g. Yonex" />
                </View>
                <View className="flex-1">
                  <Label text="Size" />
                  <IconField icon="straighten" value={size} onChangeText={(v) => dispatch(setSize(v))} placeholder="e.g. Full Size" />
                </View>
              </View>
              <View className="mb-6">
                <LabelPill text="Sport Type" />
                <PillRow options={SPORT_TYPE_OPTIONS} value={sportType} onSelect={(v) => dispatch(setSportType(v))} />
              </View>
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Label text="Material" />
                  <IconField icon="layers" value={material} onChangeText={(v) => dispatch(setMaterial(v))} placeholder="e.g. Carbon Fiber" />
                </View>
                <View className="flex-1">
                  <Label text="Color" />
                  <IconField icon="palette" value={color} onChangeText={(v) => dispatch(setColor(v))} placeholder="e.g. Black" />
                </View>
              </View>
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Label text="Weight" />
                  <IconField icon="fitness-center" value={weight} onChangeText={(v) => dispatch(setWeight(v))} placeholder="e.g. 300g" />
                </View>
                <View className="flex-1">
                  <LabelPill text="Age Group" />
                  <PillRow options={AGE_GROUP_OPTIONS} value={ageGroup} onSelect={(v) => dispatch(setAgeGroup(v))} />
                </View>
              </View>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              COLLECTIBLES FIELDS
             ═══════════════════════════════════════════════════════════════ */}
          {isCollectible && (
            <>
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Label text="Brand / Maker" />
                  <IconField icon="branding-watermark" value={brand} onChangeText={(v) => dispatch(setBrand(v))} placeholder="e.g. Royal Mint" />
                </View>
                <View className="flex-1">
                  <Label text="Era / Period" />
                  <IconField icon="history" value={era} onChangeText={(v) => dispatch(setEra(v))} placeholder="e.g. 1960s" />
                </View>
              </View>
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Label text="Material" />
                  <IconField icon="layers" value={material} onChangeText={(v) => dispatch(setMaterial(v))} placeholder="e.g. Silver" />
                </View>
                <View className="flex-1">
                  <Label text="Color" />
                  <IconField icon="palette" value={color} onChangeText={(v) => dispatch(setColor(v))} placeholder="e.g. Gold" />
                </View>
              </View>
              <View className="mb-6">
                <LabelPill text="Rarity" />
                <PillRow options={RARITY_OPTIONS} value={rarity} onSelect={(v) => dispatch(setRarity(v))} />
              </View>
              <View className="mb-6">
                <LabelPill text="Authenticity" />
                <PillRow options={AUTHENTICITY_OPTIONS} value={authenticity} onSelect={(v) => dispatch(setAuthenticity(v))} />
              </View>
              <View className="mb-6">
                <Label text="Origin / Country" />
                <IconField icon="public" value={origin} onChangeText={(v) => dispatch(setOrigin(v))} placeholder="e.g. India" />
              </View>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              PETS FIELDS
             ═══════════════════════════════════════════════════════════════ */}
          {isPet && (
            <>
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Label text="Breed" />
                  <IconField icon="pets" value={breed} onChangeText={(v) => dispatch(setBreed(v))} placeholder="e.g. Golden Retriever" />
                </View>
                <View className="flex-1">
                  <Label text="Age" />
                  <IconField icon="cake" value={petAge} onChangeText={(v) => dispatch(setPetAge(v))} placeholder="e.g. 2 years" />
                </View>
              </View>
              <View className="mb-6">
                <LabelPill text="Gender" />
                <PillRow options={PET_GENDER_OPTIONS} value={gender} onSelect={(v) => dispatch(setGender(v))} />
              </View>
              <View className="mb-6">
                <LabelPill text="Vaccinated" />
                <PillRow options={VACCINATED_OPTIONS} value={vaccinated} onSelect={(v) => dispatch(setVaccinated(v))} />
              </View>
              <View className="mb-6">
                <LabelPill text="Trained" />
                <PillRow options={TRAINED_OPTIONS} value={trained} onSelect={(v) => dispatch(setTrained(v))} />
              </View>
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Label text="Color" />
                  <IconField icon="palette" value={color} onChangeText={(v) => dispatch(setColor(v))} placeholder="e.g. Golden" />
                </View>
                <View className="flex-1">
                  <Label text="Weight" />
                  <IconField icon="fitness-center" value={weight} onChangeText={(v) => dispatch(setWeight(v))} placeholder="e.g. 12 kg" />
                </View>
              </View>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              BOOKS FIELDS
             ═══════════════════════════════════════════════════════════════ */}
          {isBook && (
            <>
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Label text="Author" />
                  <IconField icon="person" value={author} onChangeText={(v) => dispatch(setAuthor(v))} placeholder="e.g. J.K. Rowling" />
                </View>
                <View className="flex-1">
                  <Label text="Publisher" />
                  <IconField icon="business" value={publisher} onChangeText={(v) => dispatch(setPublisher(v))} placeholder="e.g. Penguin" />
                </View>
              </View>
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Label text="ISBN" />
                  <IconField icon="qr-code" value={isbn} onChangeText={(v) => dispatch(setIsbn(v))} placeholder="e.g. 978-0-13..." />
                </View>
                <View className="flex-1">
                  <Label text="Edition" />
                  <IconField icon="menu-book" value={edition} onChangeText={(v) => dispatch(setEdition(v))} placeholder="e.g. 3rd" />
                </View>
              </View>
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Label text="Language" />
                  <IconField icon="translate" value={language} onChangeText={(v) => dispatch(setLanguage(v))} placeholder="e.g. English" />
                </View>
                <View className="flex-1">
                  <Label text="Pages" />
                  <IconField icon="description" value={pages} onChangeText={(v) => dispatch(setPages(v))} placeholder="e.g. 320" numeric />
                </View>
              </View>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              BEAUTY FIELDS
             ═══════════════════════════════════════════════════════════════ */}
          {isBeauty && (
            <>
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Label text="Brand" />
                  <IconField icon="branding-watermark" value={brand} onChangeText={(v) => dispatch(setBrand(v))} placeholder="e.g. MAC" />
                </View>
                <View className="flex-1">
                  <Label text="Shade" />
                  <IconField icon="palette" value={shade} onChangeText={(v) => dispatch(setShade(v))} placeholder="e.g. Ruby Woo" />
                </View>
              </View>
              <View className="mb-6">
                <LabelPill text="Skin Type" />
                <PillRow options={SKIN_TYPE_OPTIONS} value={skinType} onSelect={(v) => dispatch(setSkinType(v))} />
              </View>
              <View className="mb-6">
                <LabelPill text="Gender" />
                <PillRow options={BEAUTY_GENDER_OPTIONS} value={gender} onSelect={(v) => dispatch(setGender(v))} />
              </View>
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Label text="Volume" />
                  <IconField icon="local-drink" value={volume} onChangeText={(v) => dispatch(setVolume(v))} placeholder="e.g. 50ml" />
                </View>
                <View className="flex-1">
                  <Label text="Expiry Date" />
                  <IconField icon="event" value={expiryDate} onChangeText={(v) => dispatch(setExpiryDate(v))} placeholder="e.g. Dec 2026" />
                </View>
              </View>
              <View className="mb-6">
                <Label text="Key Ingredients" />
                <IconField icon="science" value={ingredients} onChangeText={(v) => dispatch(setIngredients(v))} placeholder="e.g. Retinol, Vitamin C" />
              </View>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              TOYS FIELDS
             ═══════════════════════════════════════════════════════════════ */}
          {isToy && (
            <>
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Label text="Brand" />
                  <IconField icon="branding-watermark" value={brand} onChangeText={(v) => dispatch(setBrand(v))} placeholder="e.g. LEGO" />
                </View>
                <View className="flex-1">
                  <Label text="Age Group" />
                  <IconField icon="child-care" value={ageGroup} onChangeText={(v) => dispatch(setAgeGroup(v))} placeholder="e.g. 3-6 years" />
                </View>
              </View>
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Label text="Material" />
                  <IconField icon="layers" value={material} onChangeText={(v) => dispatch(setMaterial(v))} placeholder="e.g. Plastic" />
                </View>
                <View className="flex-1">
                  <Label text="Color" />
                  <IconField icon="palette" value={color} onChangeText={(v) => dispatch(setColor(v))} placeholder="e.g. Multi" />
                </View>
              </View>
              <View className="mb-6">
                <LabelPill text="Battery Required" />
                <PillRow options={BATTERY_REQUIRED_OPTIONS} value={batteryRequired} onSelect={(v) => dispatch(setBatteryRequired(v))} />
              </View>
              <View className="mb-6 flex-row gap-4">
                <View className="flex-1">
                  <Label text="Play Mode" />
                  <IconField icon="sports-esports" value={playMode} onChangeText={(v) => dispatch(setPlayMode(v))} placeholder="e.g. Solo / Multi" />
                </View>
                <View className="flex-1">
                  <Label text="No. of Pieces" />
                  <IconField icon="format-list-numbered" value={numberOfPieces} onChangeText={(v) => dispatch(setNumberOfPieces(v))} placeholder="e.g. 500" />
                </View>
              </View>
              <View className="mb-6">
                <Label text="Character / Theme" />
                <IconField icon="face" value={characterTheme} onChangeText={(v) => dispatch(setCharacterTheme(v))} placeholder="e.g. Star Wars" />
              </View>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              FOR SALE (legacy multi-cat) — show fields based on subcategory
             ═══════════════════════════════════════════════════════════════ */}
          {isForSale && (
            <>
              {/* Mobile sub-group in forsale */}
              {["Mobile Phones", "Accessories", "Tablets"].includes(subcategory) && (
                <>
                  <View className="mb-6 flex-row gap-4">
                    <View className="flex-1">
                      <Label text="Brand" />
                      <IconField icon="branding-watermark" value={brand} onChangeText={(v) => dispatch(setBrand(v))} placeholder="e.g. Apple" />
                    </View>
                    <View className="flex-1">
                      <Label text="Model" />
                      <IconField icon="info-outline" value={productModel} onChangeText={(v) => dispatch(setModel(v))} placeholder="e.g. iPhone 15" />
                    </View>
                  </View>
                  <View className="mb-6 flex-row gap-4">
                    <View className="flex-1">
                      <Label text="Storage" />
                      <IconField icon="sd-storage" value={storage} onChangeText={(v) => dispatch(setStorage(v))} placeholder="e.g. 128 GB" />
                    </View>
                    <View className="flex-1">
                      <Label text="RAM" />
                      <IconField icon="developer-board" value={ram} onChangeText={(v) => dispatch(setRam(v))} placeholder="e.g. 8 GB" />
                    </View>
                  </View>
                  <View className="mb-6">
                    <Label text="Color" />
                    <IconField icon="palette" value={color} onChangeText={(v) => dispatch(setColor(v))} placeholder="e.g. Black" />
                  </View>
                </>
              )}
              {/* Furniture sub-group in forsale */}
              {["Sofas & Dining", "Beds & Wardrobes", "Tables & Chairs", "Home Decor", "Office Furniture"].includes(subcategory) && (
                <>
                  <View className="mb-6 flex-row gap-4">
                    <View className="flex-1">
                      <Label text="Material" />
                      <IconField icon="layers" value={material} onChangeText={(v) => dispatch(setMaterial(v))} placeholder="e.g. Wood" />
                    </View>
                    <View className="flex-1">
                      <Label text="Color" />
                      <IconField icon="palette" value={color} onChangeText={(v) => dispatch(setColor(v))} placeholder="e.g. Walnut" />
                    </View>
                  </View>
                  <View className="mb-6">
                    <Label text="Dimensions" />
                    <IconField icon="straighten" value={dimensions} onChangeText={(v) => dispatch(setDimensions(v))} placeholder="e.g. LxWxH" />
                  </View>
                </>
              )}
              {/* Fashion sub-group in forsale */}
              {["Men's Clothing", "Women's Clothing", "Kids Clothing", "Footwear", "Watches"].includes(subcategory) && (
                <>
                  <View className="mb-6 flex-row gap-4">
                    <View className="flex-1">
                      <Label text="Size" />
                      <IconField icon="straighten" value={size} onChangeText={(v) => dispatch(setSize(v))} placeholder="e.g. L" />
                    </View>
                    <View className="flex-1">
                      <Label text="Color" />
                      <IconField icon="palette" value={color} onChangeText={(v) => dispatch(setColor(v))} placeholder="e.g. Red" />
                    </View>
                  </View>
                  <View className="mb-6">
                    <LabelPill text="Gender" />
                    <PillRow options={FASHION_GENDER_OPTIONS} value={gender} onSelect={(v) => dispatch(setGender(v))} />
                  </View>
                </>
              )}
              {/* Books sub-group in forsale */}
              {["Fiction", "Non-Fiction", "Children's Books", "Textbooks", "Comics", "Magazines"].includes(subcategory) && (
                <View className="mb-6 flex-row gap-4">
                  <View className="flex-1">
                    <Label text="Author" />
                    <IconField icon="person" value={author} onChangeText={(v) => dispatch(setAuthor(v))} placeholder="e.g. Author name" />
                  </View>
                  <View className="flex-1">
                    <Label text="ISBN" />
                    <IconField icon="qr-code" value={isbn} onChangeText={(v) => dispatch(setIsbn(v))} placeholder="ISBN" />
                  </View>
                </View>
              )}
              {/* Sports sub-group in forsale */}
              {["Exercise", "Camping", "Sports Equipment", "Gym & Fitness", "Cycling"].includes(subcategory) && (
                <View className="mb-6">
                  <LabelPill text="Sport Type" />
                  <PillRow options={SPORT_TYPE_OPTIONS} value={sportType} onSelect={(v) => dispatch(setSportType(v))} />
                </View>
              )}
            </>
          )}

          {/* ── Tip Box ── */}
          <View className="flex-row gap-4 rounded-xl border border-slate-100 bg-white/70 p-4">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-[rgba(39,187,151,0.1)]">
              <MaterialIcons name="lightbulb" size={22} color="#27BB97" />
            </View>
            <View className="flex-1">
              <Text className="mb-1 text-[12px] font-semibold text-[#0F172A]">Seller Pro-Tip</Text>
              <Text className="text-[12px] leading-5 text-[#6C7A74]">
                Ads with a clear title and fair pricing receive 3x more inquiries. Consider checking similar listings to stay competitive.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Footer — Next button only, right-aligned */}
      <View
        className="absolute inset-x-0 bottom-0 z-50 flex-row items-center justify-end border-t border-slate-100 bg-white px-4"
        style={{
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 16,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.05,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <Pressable
          onPress={() => router.push("/post-ad-step3-media")}
          style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.95 : 1 }] })}
        >
          <LinearGradient
            colors={["#27BB97", "#1E9E7E"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{
              height: 48,
              paddingHorizontal: 32,
              borderRadius: 8,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text className="text-[14px] font-bold text-white">Next</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}
