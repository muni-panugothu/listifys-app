import { CALLING_CODE } from "@/providers/locale-provider";
import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

type PhoneValidationResult = {
  isValid: boolean;
  nationalNumber: string;
  e164Phone?: string;
  message?: string;
};

const COUNTRY_NAMES: Record<string, string> = {
  IN: "India",
  US: "United States",
  CA: "Canada",
  GB: "United Kingdom",
  AU: "Australia",
};

function countryName(iso?: string | null): string {
  if (!iso) return "the selected country";
  return COUNTRY_NAMES[iso.toUpperCase()] ?? iso.toUpperCase();
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function asCountryCode(iso?: string | null): CountryCode | undefined {
  const normalized = iso?.toUpperCase();
  return normalized && /^[A-Z]{2}$/.test(normalized)
    ? (normalized as CountryCode)
    : undefined;
}

export function validateListingContactPhone(params: {
  phone: string;
  selectedIso?: string | null;
  selectedPhoneCode: string;
  expectedIso?: string | null;
  expectedPhoneCode?: string;
}): PhoneValidationResult {
  const selectedIso = params.selectedIso?.toUpperCase();
  const expectedIso = params.expectedIso?.toUpperCase() ?? selectedIso;
  const expectedPhoneCode =
    params.expectedPhoneCode ??
    (expectedIso ? CALLING_CODE[expectedIso] : undefined) ??
    params.selectedPhoneCode;
  const rawPhone = params.phone.trim();
  const expectedCountry = asCountryCode(expectedIso);
  const parsedPhone = parsePhoneNumberFromString(rawPhone, expectedCountry);
  const nationalNumber = parsedPhone?.nationalNumber ?? digitsOnly(rawPhone);

  if (!nationalNumber) {
    return {
      isValid: true,
      nationalNumber: "",
      e164Phone: undefined,
    };
  }

  if (
    expectedIso &&
    selectedIso &&
    selectedIso !== expectedIso
  ) {
    return {
      isValid: false,
      nationalNumber,
      message: `Select the ${countryName(expectedIso)} calling code for this listing location.`,
    };
  }

  if (!parsedPhone || !parsedPhone.isValid()) {
    return {
      isValid: false,
      nationalNumber,
      message: `Enter a valid ${countryName(expectedIso)} phone number.`,
    };
  }

  if (expectedIso && parsedPhone.country && parsedPhone.country !== expectedIso) {
    return {
      isValid: false,
      nationalNumber,
      message: `This looks like a ${countryName(parsedPhone.country)} number. Enter a ${countryName(expectedIso)} number for this listing location.`,
    };
  }

  return {
    isValid: true,
    nationalNumber,
    e164Phone: parsedPhone.number || `${expectedPhoneCode}${nationalNumber}`,
  };
}
