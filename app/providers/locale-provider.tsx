/**
 * LocaleProvider – wraps the app and exposes per-user locale info:
 *   - isoCountryCode  (ISO 3166-1 alpha-2, e.g. "IN", "US", "GB")
 *   - currencyCode    (ISO 4217,  e.g. "INR", "USD", "GBP")
 *   - phoneCode       (E.164 calling code, e.g. "+91", "+1", "+44")
 *
 * Priority order for country resolution:
 *   1. isoCountryCode stored in Redux location slice (set when user grants
 *      GPS or types/searches an address — most accurate)
 *   2. Device locale region parsed from Intl API (always available, but
 *      represents the *device language setting*, not physical location)
 *   3. Fallback → India ("IN") — matches the app's default currency (₹)
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from "react";

import { getCurrencyCodeFromCountry, getCurrencySymbol } from "@/lib/currency";
import { useAppSelector } from "@/store/hooks";
import { selectIsoCountryCode } from "@/store/slices/location-slice";

// ---------------------------------------------------------------------------
// Country → calling code map (E.164 prefix without the leading "+")
// ---------------------------------------------------------------------------
const CALLING_CODE: Record<string, string> = {
  AF: "+93",  AL: "+355", DZ: "+213", AD: "+376", AO: "+244", AR: "+54",
  AM: "+374", AU: "+61",  AT: "+43",  AZ: "+994", BH: "+973", BD: "+880",
  BY: "+375", BE: "+32",  BZ: "+501", BJ: "+229", BT: "+975", BO: "+591",
  BA: "+387", BW: "+267", BR: "+55",  BN: "+673", BG: "+359", BF: "+226",
  BI: "+257", KH: "+855", CM: "+237", CA: "+1",   CV: "+238", CF: "+236",
  TD: "+235", CL: "+56",  CN: "+86",  CO: "+57",  KM: "+269", CG: "+242",
  CD: "+243", CR: "+506", HR: "+385", CU: "+53",  CY: "+357", CZ: "+420",
  DK: "+45",  DJ: "+253", DO: "+1",   EC: "+593", EG: "+20",  SV: "+503",
  GQ: "+240", ER: "+291", EE: "+372", ET: "+251", FJ: "+679", FI: "+358",
  FR: "+33",  GA: "+241", GM: "+220", GE: "+995", DE: "+49",  GH: "+233",
  GR: "+30",  GT: "+502", GN: "+224", GW: "+245", GY: "+592", HT: "+509",
  HN: "+504", HK: "+852", HU: "+36",  IS: "+354", IN: "+91",  ID: "+62",
  IR: "+98",  IQ: "+964", IE: "+353", IL: "+972", IT: "+39",  JM: "+1",
  JP: "+81",  JO: "+962", KZ: "+7",   KE: "+254", KI: "+686", KP: "+850",
  KR: "+82",  KW: "+965", KG: "+996", LA: "+856", LV: "+371", LB: "+961",
  LS: "+266", LR: "+231", LY: "+218", LI: "+423", LT: "+370", LU: "+352",
  MO: "+853", MK: "+389", MG: "+261", MW: "+265", MY: "+60",  MV: "+960",
  ML: "+223", MT: "+356", MH: "+692", MR: "+222", MU: "+230", MX: "+52",
  FM: "+691", MD: "+373", MC: "+377", MN: "+976", ME: "+382", MA: "+212",
  MZ: "+258", MM: "+95",  NA: "+264", NR: "+674", NP: "+977", NL: "+31",
  NZ: "+64",  NI: "+505", NE: "+227", NG: "+234", NO: "+47",  OM: "+968",
  PK: "+92",  PW: "+680", PA: "+507", PG: "+675", PY: "+595", PE: "+51",
  PH: "+63",  PL: "+48",  PT: "+351", QA: "+974", RO: "+40",  RU: "+7",
  RW: "+250", KN: "+1",   LC: "+1",   VC: "+1",   WS: "+685", SM: "+378",
  ST: "+239", SA: "+966", SN: "+221", RS: "+381", SC: "+248", SL: "+232",
  SG: "+65",  SK: "+421", SI: "+386", SB: "+677", SO: "+252", ZA: "+27",
  SS: "+211", ES: "+34",  LK: "+94",  SD: "+249", SR: "+597", SZ: "+268",
  SE: "+46",  CH: "+41",  SY: "+963", TW: "+886", TJ: "+992", TZ: "+255",
  TH: "+66",  TL: "+670", TG: "+228", TO: "+676", TT: "+1",   TN: "+216",
  TR: "+90",  TM: "+993", TV: "+688", UG: "+256", UA: "+380", AE: "+971",
  GB: "+44",  US: "+1",   UY: "+598", UZ: "+998", VU: "+678", VE: "+58",
  VN: "+84",  YE: "+967", ZM: "+260", ZW: "+263",
};

/** Derive the E.164 calling code for a country, e.g. "IN" → "+91". */
function getPhoneCodeFromCountry(isoCountryCode?: string | null): string {
  if (!isoCountryCode) return "+91";
  return CALLING_CODE[isoCountryCode.toUpperCase()] ?? "+91";
}

/**
 * Try to extract a two-letter region code from the device's Intl locale
 * (e.g. "en-US" → "US", "hi-IN" → "IN").
 * Returns null when no region is detectable.
 */
function getDeviceRegionCode(): string | null {
  try {
    // Intl.DateTimeFormat().resolvedOptions().locale is widely available in RN.
    const locale = Intl.DateTimeFormat().resolvedOptions().locale; // e.g. "en-US"
    const parts = locale.split("-");
    if (parts.length >= 2) {
      const region = parts[parts.length - 1];
      if (/^[A-Za-z]{2}$/.test(region)) return region.toUpperCase();
    }
  } catch {
    // Intl not available — very unlikely in modern RN
  }
  return null;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
export type LocaleContextValue = {
  /** ISO 3166-1 alpha-2 country code (e.g. "IN", "US", "GB"). */
  isoCountryCode: string;
  /** ISO 4217 currency code (e.g. "INR", "USD", "GBP"). */
  currencyCode: string;
  /** Narrow currency symbol (e.g. "₹", "$", "£"). */
  currencySymbol: string;
  /** E.164 calling-code prefix (e.g. "+91", "+1", "+44"). */
  phoneCode: string;
  /** Lookup helper: phone code for any country. */
  phoneCodeForCountry: (iso: string) => string;
};

const LocaleContext = createContext<LocaleContextValue>({
  isoCountryCode: "IN",
  currencyCode: "INR",
  currencySymbol: "₹",
  phoneCode: "+91",
  phoneCodeForCountry: (iso) => getPhoneCodeFromCountry(iso),
});

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const storedCountry = useAppSelector(selectIsoCountryCode);

  const phoneCodeForCountry = useCallback(
    (iso: string) => getPhoneCodeFromCountry(iso),
    [],
  );

  const value = useMemo((): LocaleContextValue => {
    // Resolution priority: Redux store → device Intl locale → default "IN"
    const country =
      storedCountry?.toUpperCase() ??
      getDeviceRegionCode() ??
      "IN";

    const currencyCode = getCurrencyCodeFromCountry(country);
    const currencySymbol = getCurrencySymbol(currencyCode);
    const phoneCode = getPhoneCodeFromCountry(country);

    return {
      isoCountryCode: country,
      currencyCode,
      currencySymbol,
      phoneCode,
      phoneCodeForCountry,
    };
  }, [storedCountry, phoneCodeForCountry]);

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

// Re-export so consumers can use these helpers without importing from two places.
export { getPhoneCodeFromCountry, CALLING_CODE };
