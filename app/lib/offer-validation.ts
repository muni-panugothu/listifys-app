const OFFER_RANGE_PERCENT = 0.2;

export type OfferValidationResult =
  | { valid: true }
  | { valid: false; error: string };

/** Parse a listed price from API / form values (number, string, nested object). */
export function parseListedPrice(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? Math.round(n) : 0;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return parseListedPrice(obj.amount ?? obj.price ?? obj.value);
  }
  return 0;
}

/** Validate offer amount is within ±20% of the listed price (inclusive). */
export function validateOfferAmount(
  amount: number,
  listedPrice: number,
): OfferValidationResult {
  const parsedAmount = Math.round(amount);
  const parsedPrice = parseListedPrice(listedPrice);

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return { valid: false, error: "Enter a valid offer amount." };
  }
  if (parsedPrice <= 0) {
    return { valid: true };
  }

  const min = Math.floor(parsedPrice * (1 - OFFER_RANGE_PERCENT));
  const max = Math.ceil(parsedPrice * (1 + OFFER_RANGE_PERCENT));

  if (parsedAmount < min) {
    return {
      valid: false,
      error: `Amount is too low. Offer must be between ${min.toLocaleString("en-IN")} and ${max.toLocaleString("en-IN")}.`,
    };
  }
  if (parsedAmount > max) {
    return {
      valid: false,
      error: `Amount is too high. Offer must be between ${min.toLocaleString("en-IN")} and ${max.toLocaleString("en-IN")}.`,
    };
  }

  return { valid: true };
}

/** Suggested chip amounts within the ±20% range. */
export function getSuggestedOfferAmounts(listedPrice: number): number[] {
  const parsedPrice = parseListedPrice(listedPrice);
  if (parsedPrice <= 0) return [];

  const min = Math.floor(parsedPrice * (1 - OFFER_RANGE_PERCENT));
  const max = Math.ceil(parsedPrice * (1 + OFFER_RANGE_PERCENT));
  const candidates = [
    min,
    Math.round(parsedPrice * 0.9),
    parsedPrice,
    Math.round(parsedPrice * 1.1),
    max,
  ];

  const rounded = candidates.map((v) => Math.round(v));
  return [...new Set(rounded.filter((v) => v >= min && v <= max))].slice(0, 4);
}

export function getOfferRange(listedPrice: number): { min: number; max: number } | null {
  const parsedPrice = parseListedPrice(listedPrice);
  if (parsedPrice <= 0) return null;
  return {
    min: Math.floor(parsedPrice * (1 - OFFER_RANGE_PERCENT)),
    max: Math.ceil(parsedPrice * (1 + OFFER_RANGE_PERCENT)),
  };
}
