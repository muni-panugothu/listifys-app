/**
 * Currency utilities – format prices and return currency symbols.
 *
 * Countries that use miles for distance typically have well-known local
 * currencies; this module maps ISO 3166-1 alpha-2 country codes to their
 * ISO 4217 currency codes so the app can show the right symbol for every
 * user regardless of where they are.
 */

/** Maps ISO 3166-1 alpha-2 country code → ISO 4217 currency code. */
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  US: "USD",
  GB: "GBP",
  EU: "EUR",
  DE: "EUR",
  FR: "EUR",
  IT: "EUR",
  ES: "EUR",
  NL: "EUR",
  BE: "EUR",
  AT: "EUR",
  PT: "EUR",
  GR: "EUR",
  IE: "EUR",
  FI: "EUR",
  AU: "AUD",
  CA: "CAD",
  IN: "INR",
  PK: "PKR",
  BD: "BDT",
  LK: "LKR",
  NP: "NPR",
  AE: "AED",
  SA: "SAR",
  QA: "QAR",
  KW: "KWD",
  BH: "BHD",
  OM: "OMR",
  SG: "SGD",
  MY: "MYR",
  PH: "PHP",
  ID: "IDR",
  TH: "THB",
  VN: "VND",
  JP: "JPY",
  CN: "CNY",
  KR: "KRW",
  HK: "HKD",
  TW: "TWD",
  NZ: "NZD",
  ZA: "ZAR",
  NG: "NGN",
  GH: "GHS",
  KE: "KES",
  EG: "EGP",
  MA: "MAD",
  MX: "MXN",
  BR: "BRL",
  AR: "ARS",
  CO: "COP",
  CL: "CLP",
  RU: "RUB",
  TR: "TRY",
  CH: "CHF",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  PL: "PLN",
  CZ: "CZK",
  HU: "HUF",
};

/** Maps ISO 4217 currency code → locale best suited for Intl.NumberFormat. */
const CURRENCY_LOCALE: Record<string, string> = {
  USD: "en-US",
  GBP: "en-GB",
  EUR: "de-DE",
  AUD: "en-AU",
  CAD: "en-CA",
  INR: "en-IN",
  PKR: "en-PK",
  BDT: "bn-BD",
  LKR: "si-LK",
  NPR: "ne-NP",
  AED: "ar-AE",
  SAR: "ar-SA",
  QAR: "ar-QA",
  KWD: "ar-KW",
  BHD: "ar-BH",
  OMR: "ar-OM",
  SGD: "en-SG",
  MYR: "ms-MY",
  PHP: "en-PH",
  IDR: "id-ID",
  THB: "th-TH",
  VND: "vi-VN",
  JPY: "ja-JP",
  CNY: "zh-CN",
  KRW: "ko-KR",
  HKD: "en-HK",
  TWD: "zh-TW",
  NZD: "en-NZ",
  ZAR: "en-ZA",
  NGN: "en-NG",
  GHS: "en-GH",
  KES: "sw-KE",
  EGP: "ar-EG",
  MAD: "ar-MA",
  MXN: "es-MX",
  BRL: "pt-BR",
  ARS: "es-AR",
  COP: "es-CO",
  CLP: "es-CL",
  RUB: "ru-RU",
  TRY: "tr-TR",
  CHF: "de-CH",
  SEK: "sv-SE",
  NOK: "nb-NO",
  DKK: "da-DK",
  PLN: "pl-PL",
  CZK: "cs-CZ",
  HUF: "hu-HU",
};

/** Well-known narrow currency symbols (used when Intl isn't narrow enough). */
const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$",
  GBP: "£",
  EUR: "€",
  AUD: "A$",
  CAD: "C$",
  INR: "₹",
  PKR: "Rs",
  BDT: "৳",
  LKR: "Rs",
  NPR: "Rs",
  AED: "د.إ",
  SAR: "﷼",
  QAR: "ر.ق",
  KWD: "د.ك",
  BHD: "BD",
  OMR: "ر.ع.",
  SGD: "S$",
  MYR: "RM",
  PHP: "₱",
  IDR: "Rp",
  THB: "฿",
  VND: "₫",
  JPY: "¥",
  CNY: "¥",
  KRW: "₩",
  HKD: "HK$",
  TWD: "NT$",
  NZD: "NZ$",
  ZAR: "R",
  NGN: "₦",
  GHS: "₵",
  KES: "KSh",
  EGP: "E£",
  MAD: "MAD",
  MXN: "MX$",
  BRL: "R$",
  ARS: "$",
  COP: "$",
  CLP: "$",
  RUB: "₽",
  TRY: "₺",
  CHF: "CHF",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  PLN: "zł",
  CZK: "Kč",
  HUF: "Ft",
};

/** Default currency code when no country is known. */
const DEFAULT_CURRENCY = "INR";

/**
 * Resolve the ISO 4217 currency code for a given ISO 3166-1 alpha-2 country
 * code. Returns the default (INR) when the country is unknown.
 */
export function getCurrencyCodeFromCountry(
  isoCountryCode?: string | null,
): string {
  if (!isoCountryCode) return DEFAULT_CURRENCY;
  return COUNTRY_TO_CURRENCY[isoCountryCode.toUpperCase()] ?? DEFAULT_CURRENCY;
}

/**
 * Returns the narrow symbol for a currency code, e.g. "₹", "$", "£".
 * Pass an ISO 4217 currency code directly, or pass nothing for the default.
 */
export function getCurrencySymbol(currencyCode?: string | null): string {
  const code = currencyCode?.toUpperCase() ?? DEFAULT_CURRENCY;
  return CURRENCY_SYMBOL[code] ?? code;
}

/**
 * Formats a numeric price value with the correct currency symbol and
 * locale-aware digit grouping.
 *
 * @example
 *   formatPrice(24999)          // "₹24,999"
 *   formatPrice(24999, "USD")   // "$24,999"
 *   formatPrice(24999, "GBP")   // "£24,999"
 */
export function formatPrice(
  amount: number | null | undefined,
  currencyCode?: string | null,
  isoCountryCode?: string | null,
): string {
  if (amount == null || !Number.isFinite(amount)) return "";

  const code = (
    currencyCode?.toUpperCase() ??
    getCurrencyCodeFromCountry(isoCountryCode)
  ) as string;
  const locale = CURRENCY_LOCALE[code] ?? "en-IN";

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    // Fallback if Intl doesn't support this currency
    const symbol = CURRENCY_SYMBOL[code] ?? code;
    const formatted = new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
    return `${symbol}${formatted}`;
  }
}
