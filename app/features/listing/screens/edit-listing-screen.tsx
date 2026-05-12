/**
 * EditListingScreen — loads listing data from the API and allows
 * editing title, price, description, condition. Handles update + delete
 * with actual API calls (including S3 image cleanup on delete).
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { CategorySlug } from "@/constants/categories";
import { CONDITION_SKIP_CATEGORIES, PRICE_OPTIONAL_CATEGORIES } from "@/constants/categories";
import {
  deleteListing,
  fetchListingById,
  updateListing,
  type ListingItem,
} from "@/features/listing/services/listing-api";
import { Image } from "@/lib/nativewind-interop";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IMAGE_GAP = 12;
const SIDE_IMAGE_SIZE = (SCREEN_WIDTH - 32 - IMAGE_GAP * 2) / 3;

const CONDITIONS = ["New", "Like New", "Good", "Fair", "For Parts"];

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

  // Editable fields
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [condition, setCondition] = useState("");
  const [location, setLocation] = useState("");

  // Event-specific editable fields
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [venue, setVenue] = useState("");
  const [ticketsAvailable, setTicketsAvailable] = useState("");
  const [ageRestriction, setAgeRestriction] = useState("");
  const [dressCode, setDressCode] = useState("");

  // Job-specific editable fields
  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [applyLink, setApplyLink] = useState("");
  const [jobType, setJobType] = useState("");
  const [experience, setExperience] = useState("");
  const [education, setEducation] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [workMode, setWorkMode] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [salaryType, setSalaryType] = useState("");
  const [industry, setIndustry] = useState("");
  const [positions, setPositions] = useState("");

  const isEvent = categorySlug === "events";
  const isJob = categorySlug === "jobs";
  const skipCondition = CONDITION_SKIP_CATEGORIES.includes(categorySlug);
  const showPriceSection = !PRICE_OPTIONAL_CATEGORIES.includes(categorySlug);

  const topBarHeight = useMemo(() => insets.top + 64, [insets.top]);

  // Load listing data
  useEffect(() => {
    if (!listingId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetchListingById(categorySlug, listingId);
        if (res.listing) {
          setListing(res.listing);
          setTitle(res.listing.title || "");
          setPrice(res.listing.price ? String(res.listing.price) : "");
          setDescription(res.listing.description || "");
          setCondition(res.listing.condition || "");
          setLocation(res.listing.location || "");
          // Event-specific fields
          const l = res.listing as any;
          if (l.eventDate) setEventDate(l.eventDate);
          if (l.eventTime) setEventTime(l.eventTime);
          if (l.organizer) setOrganizer(l.organizer);
          if (l.venue) setVenue(l.venue);
          if (l.ticketsAvailable) setTicketsAvailable(String(l.ticketsAvailable));
          if (l.ageRestriction) setAgeRestriction(l.ageRestriction);
          if (l.dressCode) setDressCode(l.dressCode);
          // Job-specific fields
          if (l.companyName) setCompanyName(l.companyName);
          if (l.companyEmail) setCompanyEmail(l.companyEmail);
          if (l.applyLink) setApplyLink(l.applyLink);
          if (l.jobType) setJobType(l.jobType);
          if (l.experience) setExperience(l.experience);
          if (l.education) setEducation(l.education);
          if (l.employmentType) setEmploymentType(l.employmentType);
          if (l.workMode) setWorkMode(l.workMode);
          if (l.salary?.min) setSalaryMin(String(l.salary.min));
          if (l.salary?.max) setSalaryMax(String(l.salary.max));
          if (l.salaryType || l.salary?.type) setSalaryType(l.salaryType || l.salary?.type || "");
          if (l.industry) setIndustry(l.industry);
          if (l.positions) setPositions(String(l.positions));
        }
      } catch {
        Alert.alert("Error", "Failed to load listing data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [categorySlug, listingId]);

  const handleSave = useCallback(async () => {
    if (!listingId || !title.trim()) {
      Alert.alert("Validation", "Title is required.");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        price: price ? Number(price) : undefined,
        description: description.trim(),
        condition: condition || undefined,
        location: location.trim() || undefined,
      };
      // Event-specific fields
      if (isEvent) {
        if (eventDate) body.eventDate = eventDate;
        if (eventTime) body.eventTime = eventTime;
        if (organizer) body.organizer = organizer.trim();
        if (venue) body.venue = venue.trim();
        if (ticketsAvailable) body.ticketsAvailable = Number(ticketsAvailable);
        if (ageRestriction) body.ageRestriction = ageRestriction.trim();
        if (dressCode) body.dressCode = dressCode.trim();
      }
      // Job-specific fields
      if (isJob) {
        if (companyName) body.companyName = companyName.trim();
        if (companyEmail) body.companyEmail = companyEmail.trim();
        if (applyLink) body.applyLink = applyLink.trim();
        if (jobType) body.jobType = jobType.trim();
        if (experience) body.experience = experience.trim();
        if (education) body.education = education.trim();
        if (employmentType) body.employmentType = employmentType.trim();
        if (workMode) body.workMode = workMode.trim();
        if (salaryMin || salaryMax) {
          body.salary = {
            min: salaryMin ? Number(salaryMin) : undefined,
            max: salaryMax ? Number(salaryMax) : undefined,
            type: salaryType || "monthly",
          };
        }
        if (salaryType) body.salaryType = salaryType;
        if (industry) body.industry = industry.trim();
        if (positions) body.positions = Number(positions);
      }
      await updateListing(categorySlug, listingId, body);
      Alert.alert("Updated", "Your listing has been updated successfully.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to update listing.");
    } finally {
      setSaving(false);
    }
  }, [categorySlug, listingId, title, price, description, condition, location, isEvent, eventDate, eventTime, organizer, venue, ticketsAvailable, ageRestriction, dressCode, isJob, companyName, companyEmail, applyLink, jobType, experience, education, employmentType, workMode, salaryMin, salaryMax, salaryType, industry, positions, router]);

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
              Alert.alert("Deleted", "Listing removed successfully.", [
                { text: "OK", onPress: () => router.back() },
              ]);
            } catch {
              Alert.alert("Error", "Failed to delete listing.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }, [categorySlug, listingId, router]);

  const images = listing?.images || [];

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F4FBF6]">
        <ActivityIndicator size="large" color="#27BB97" />
        <Text className="mt-3 text-[14px] text-[#6C7A74]">Loading listing...</Text>
      </View>
    );
  }

  if (!listing) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F4FBF6]">
        <MaterialIcons name="error-outline" size={48} color="#94A3B8" />
        <Text className="mt-3 text-[16px] font-semibold text-[#6C7A74]">Listing not found</Text>
        <Pressable onPress={() => router.back()} className="mt-4 rounded-lg bg-[#27BB97] px-6 py-2.5">
          <Text className="text-[14px] font-semibold text-white">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F4FBF6]">
      {/* Top Bar */}
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
          <Text className="text-[20px] font-semibold text-[#161D1A]">
            Edit Listing
          </Text>
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
          {/* Photos Section */}
          {images.length > 0 && (
            <View className="mb-6">
              <Text className="mb-4 text-[18px] font-semibold text-[#161D1A]">
                Photos
              </Text>
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
            <View className="mb-6 rounded-2xl border border-[#DDE4DF] bg-white p-5">
              <Text className="text-[18px] font-semibold text-[#161D1A]">Pricing</Text>
              <Text className="mb-4 text-[14px] text-[#6C7A74]">Set a competitive price to sell faster.</Text>
              <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">Selling Price</Text>
              <View className="mb-4 h-12 flex-row items-center rounded-lg border border-[#BBCAC3] bg-[#EFF5F0] px-4">
                <Text className="mr-2 text-[20px] font-bold text-[#3C4A44]">₹</Text>
                <TextInput
                  value={price}
                  onChangeText={(v) => setPrice(v.replace(/[^0-9]/g, ""))}
                  keyboardType="numeric"
                  className="flex-1 text-[20px] font-bold text-[#161D1A]"
                  style={{ paddingVertical: 0 }}
                />
              </View>
            </View>
          )}

          {/* Details Section */}
          <View className="mb-6">
            <Text className="mb-4 px-1 text-[18px] font-semibold text-[#161D1A]">Details</Text>
            <View className="mb-4">
              <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">Title</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                className="rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[16px] text-[#161D1A]"
              />
            </View>
            <View className="mb-4">
              <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">Category</Text>
              <View className="h-12 flex-row items-center justify-between rounded-lg border border-[#BBCAC3] bg-slate-50 px-4">
                <Text className="text-[16px] text-[#6C7A74]">{categorySlug}</Text>
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
                className="min-h-[120px] rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[16px] text-[#161D1A]"
              />
            </View>
          </View>

          {/* Condition — skip for events and other exempt categories */}
          {!skipCondition && (
          <View className="mb-6">
            <Text className="mb-3 px-1 text-[18px] font-semibold text-[#161D1A]">Condition</Text>
            <View className="flex-row flex-wrap gap-2">
              {CONDITIONS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setCondition(c)}
                  className="rounded-full px-4 py-2"
                  style={{
                    borderWidth: 1.5,
                    borderColor: condition === c ? "#27BB97" : "#E2E8F0",
                    backgroundColor: condition === c ? "rgba(39,187,151,0.1)" : "#FFFFFF",
                  }}
                >
                  <Text
                    className="text-[13px] font-medium"
                    style={{ color: condition === c ? "#006B55" : "#3C4A44" }}
                  >
                    {c}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          )}

          {/* Event-specific fields */}
          {isEvent && (
            <View className="mb-6">
              <Text className="mb-4 px-1 text-[18px] font-semibold text-[#161D1A]">Event Details</Text>
              <View className="mb-4">
                <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">Event Date</Text>
                <TextInput
                  value={eventDate}
                  onChangeText={setEventDate}
                  placeholder="e.g. 2026-06-15"
                  placeholderTextColor="#94A3B8"
                  className="rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[16px] text-[#161D1A]"
                />
              </View>
              <View className="mb-4">
                <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">Event Time</Text>
                <TextInput
                  value={eventTime}
                  onChangeText={setEventTime}
                  placeholder="e.g. 07:00 PM"
                  placeholderTextColor="#94A3B8"
                  className="rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[16px] text-[#161D1A]"
                />
              </View>
              <View className="mb-4">
                <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">Organizer</Text>
                <TextInput
                  value={organizer}
                  onChangeText={setOrganizer}
                  placeholder="Organizer name"
                  placeholderTextColor="#94A3B8"
                  className="rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[16px] text-[#161D1A]"
                />
              </View>
              <View className="mb-4">
                <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">Venue</Text>
                <TextInput
                  value={venue}
                  onChangeText={setVenue}
                  placeholder="Venue name"
                  placeholderTextColor="#94A3B8"
                  className="rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[16px] text-[#161D1A]"
                />
              </View>
              <View className="mb-4">
                <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">Tickets Available</Text>
                <TextInput
                  value={ticketsAvailable}
                  onChangeText={(v) => setTicketsAvailable(v.replace(/[^0-9]/g, ""))}
                  keyboardType="numeric"
                  placeholder="e.g. 100"
                  placeholderTextColor="#94A3B8"
                  className="rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[16px] text-[#161D1A]"
                />
              </View>
              <View className="mb-4">
                <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">Age Restriction</Text>
                <TextInput
                  value={ageRestriction}
                  onChangeText={setAgeRestriction}
                  placeholder="e.g. 18+"
                  placeholderTextColor="#94A3B8"
                  className="rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[16px] text-[#161D1A]"
                />
              </View>
              <View>
                <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">Dress Code</Text>
                <TextInput
                  value={dressCode}
                  onChangeText={setDressCode}
                  placeholder="e.g. Smart Casual"
                  placeholderTextColor="#94A3B8"
                  className="rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[16px] text-[#161D1A]"
                />
              </View>
            </View>
          )}

          {/* Job-specific fields */}
          {isJob && (
            <View className="mb-6">
              <Text className="mb-4 px-1 text-[18px] font-semibold text-[#161D1A]">Job Details</Text>
              <View className="mb-4">
                <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">Company Name</Text>
                <TextInput
                  value={companyName}
                  onChangeText={setCompanyName}
                  placeholder="Company or business name"
                  placeholderTextColor="#94A3B8"
                  className="rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[16px] text-[#161D1A]"
                />
              </View>
              <View className="mb-4">
                <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">Company Email</Text>
                <TextInput
                  value={companyEmail}
                  onChangeText={setCompanyEmail}
                  placeholder="hr@company.com"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[16px] text-[#161D1A]"
                />
              </View>
              <View className="mb-4">
                <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">Apply Link</Text>
                <TextInput
                  value={applyLink}
                  onChangeText={setApplyLink}
                  placeholder="https://careers.company.com/apply"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  className="rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[16px] text-[#161D1A]"
                />
              </View>
              <View className="mb-4">
                <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">Job Type</Text>
                <TextInput
                  value={jobType}
                  onChangeText={setJobType}
                  placeholder="e.g. Full Time, Part Time, Contract"
                  placeholderTextColor="#94A3B8"
                  className="rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[16px] text-[#161D1A]"
                />
              </View>
              <View className="mb-4">
                <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">Work Mode</Text>
                <TextInput
                  value={workMode}
                  onChangeText={setWorkMode}
                  placeholder="e.g. Remote, On-site, Hybrid"
                  placeholderTextColor="#94A3B8"
                  className="rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[16px] text-[#161D1A]"
                />
              </View>
              <View className="mb-4">
                <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">Experience</Text>
                <TextInput
                  value={experience}
                  onChangeText={setExperience}
                  placeholder="e.g. 2-5 years"
                  placeholderTextColor="#94A3B8"
                  className="rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[16px] text-[#161D1A]"
                />
              </View>
              <View className="mb-4">
                <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">Education</Text>
                <TextInput
                  value={education}
                  onChangeText={setEducation}
                  placeholder="e.g. Bachelor's, Master's"
                  placeholderTextColor="#94A3B8"
                  className="rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[16px] text-[#161D1A]"
                />
              </View>
              <View className="mb-4">
                <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">Industry</Text>
                <TextInput
                  value={industry}
                  onChangeText={setIndustry}
                  placeholder="e.g. Technology, Healthcare"
                  placeholderTextColor="#94A3B8"
                  className="rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[16px] text-[#161D1A]"
                />
              </View>
              <View className="mb-4 flex-row gap-3">
                <View className="flex-1">
                  <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">Salary Min</Text>
                  <View className="h-12 flex-row items-center rounded-lg border border-[#BBCAC3] bg-white px-4">
                    <Text className="mr-2 text-[16px] font-bold text-[#3C4A44]">₹</Text>
                    <TextInput
                      value={salaryMin}
                      onChangeText={(v) => setSalaryMin(v.replace(/[^0-9]/g, ""))}
                      keyboardType="numeric"
                      placeholder="Min"
                      placeholderTextColor="#94A3B8"
                      className="flex-1 text-[16px] text-[#161D1A]"
                      style={{ paddingVertical: 0 }}
                    />
                  </View>
                </View>
                <View className="flex-1">
                  <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">Salary Max</Text>
                  <View className="h-12 flex-row items-center rounded-lg border border-[#BBCAC3] bg-white px-4">
                    <Text className="mr-2 text-[16px] font-bold text-[#3C4A44]">₹</Text>
                    <TextInput
                      value={salaryMax}
                      onChangeText={(v) => setSalaryMax(v.replace(/[^0-9]/g, ""))}
                      keyboardType="numeric"
                      placeholder="Max"
                      placeholderTextColor="#94A3B8"
                      className="flex-1 text-[16px] text-[#161D1A]"
                      style={{ paddingVertical: 0 }}
                    />
                  </View>
                </View>
              </View>
              <View className="mb-4">
                <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">Salary Type</Text>
                <TextInput
                  value={salaryType}
                  onChangeText={setSalaryType}
                  placeholder="e.g. monthly, yearly, hourly"
                  placeholderTextColor="#94A3B8"
                  className="rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[16px] text-[#161D1A]"
                />
              </View>
              <View>
                <Text className="mb-2 text-[12px] font-medium text-[#161D1A]">Open Positions</Text>
                <TextInput
                  value={positions}
                  onChangeText={(v) => setPositions(v.replace(/[^0-9]/g, ""))}
                  keyboardType="numeric"
                  placeholder="e.g. 3"
                  placeholderTextColor="#94A3B8"
                  className="rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[16px] text-[#161D1A]"
                />
              </View>
            </View>
          )}

          {/* Location */}
          <View className="mb-6">
            <Text className="mb-3 px-1 text-[18px] font-semibold text-[#161D1A]">Location</Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Enter location"
              placeholderTextColor="#94A3B8"
              className="rounded-lg border border-[#BBCAC3] bg-white px-4 py-3 text-[16px] text-[#161D1A]"
            />
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
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
