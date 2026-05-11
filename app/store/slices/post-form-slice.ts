import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { CategorySlug } from "@/constants/categories";

export type PostFormState = {
  // Step 1
  category: CategorySlug;
  subcategory: string;
  // Step 2
  title: string;
  description: string;
  price: string;
  condition: string;
  location: string;
  listingType: string; // "Properties" (for sale) or "Rentals" (for rent)
  // Property-specific fields
  bedrooms: string;
  bathrooms: string;
  furnishing: string;
  squareFeet: string;
  features: string[];
  petFriendly: boolean;
  availableFrom: string;
  // Step 3
  imageUris: string[]; // local URIs before upload
  uploadedImageUrls: string[]; // S3 URLs after upload
  phone: string;
  phoneCode: string;
  // Submission
  isSubmitting: boolean;
  submitError: string | null;
};

const initialState: PostFormState = {
  category: "electronics",
  subcategory: "",
  title: "",
  description: "",
  price: "",
  condition: "Good",
  location: "",
  listingType: "Properties",
  bedrooms: "",
  bathrooms: "",
  furnishing: "",
  squareFeet: "",
  features: [],
  petFriendly: false,
  availableFrom: "",
  imageUris: [],
  uploadedImageUrls: [],
  phone: "",
  phoneCode: "+91",
  isSubmitting: false,
  submitError: null,
};

const postFormSlice = createSlice({
  name: "postForm",
  initialState,
  reducers: {
    setCategory(state, action: PayloadAction<CategorySlug>) {
      state.category = action.payload;
      state.subcategory = "";
    },
    setSubcategory(state, action: PayloadAction<string>) {
      state.subcategory = action.payload;
    },
    setTitle(state, action: PayloadAction<string>) {
      state.title = action.payload;
    },
    setDescription(state, action: PayloadAction<string>) {
      state.description = action.payload;
    },
    setPrice(state, action: PayloadAction<string>) {
      state.price = action.payload;
    },
    setCondition(state, action: PayloadAction<string>) {
      state.condition = action.payload;
    },
    setLocation(state, action: PayloadAction<string>) {
      state.location = action.payload;
    },
    setListingType(state, action: PayloadAction<string>) {
      state.listingType = action.payload;
    },
    setBedrooms(state, action: PayloadAction<string>) {
      state.bedrooms = action.payload;
    },
    setBathrooms(state, action: PayloadAction<string>) {
      state.bathrooms = action.payload;
    },
    setFurnishing(state, action: PayloadAction<string>) {
      state.furnishing = action.payload;
    },
    setSquareFeet(state, action: PayloadAction<string>) {
      state.squareFeet = action.payload;
    },
    setFeatures(state, action: PayloadAction<string[]>) {
      state.features = action.payload;
    },
    toggleFeature(state, action: PayloadAction<string>) {
      const idx = state.features.indexOf(action.payload);
      if (idx >= 0) state.features.splice(idx, 1);
      else state.features.push(action.payload);
    },
    setPetFriendly(state, action: PayloadAction<boolean>) {
      state.petFriendly = action.payload;
    },
    setAvailableFrom(state, action: PayloadAction<string>) {
      state.availableFrom = action.payload;
    },
    setImageUris(state, action: PayloadAction<string[]>) {
      state.imageUris = action.payload;
    },
    addImageUri(state, action: PayloadAction<string>) {
      if (state.imageUris.length < 6) {
        state.imageUris.push(action.payload);
      }
    },
    removeImageUri(state, action: PayloadAction<number>) {
      state.imageUris.splice(action.payload, 1);
    },
    setUploadedImageUrls(state, action: PayloadAction<string[]>) {
      state.uploadedImageUrls = action.payload;
    },
    setPhone(state, action: PayloadAction<string>) {
      state.phone = action.payload;
    },
    setPhoneCode(state, action: PayloadAction<string>) {
      state.phoneCode = action.payload;
    },
    setSubmitting(state, action: PayloadAction<boolean>) {
      state.isSubmitting = action.payload;
    },
    setSubmitError(state, action: PayloadAction<string | null>) {
      state.submitError = action.payload;
    },
    resetPostForm() {
      return initialState;
    },
  },
});

export const {
  setCategory,
  setSubcategory,
  setTitle,
  setDescription,
  setPrice,
  setCondition,
  setLocation,
  setListingType,
  setBedrooms,
  setBathrooms,
  setFurnishing,
  setSquareFeet,
  setFeatures,
  toggleFeature,
  setPetFriendly,
  setAvailableFrom,
  setImageUris,
  addImageUri,
  removeImageUri,
  setUploadedImageUrls,
  setPhone,
  setPhoneCode,
  setSubmitting,
  setSubmitError,
  resetPostForm,
} = postFormSlice.actions;

export default postFormSlice.reducer;
