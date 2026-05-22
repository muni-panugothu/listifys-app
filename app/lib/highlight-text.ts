/**
 * Splits text into segments based on a search query match.
 * Matched portions are marked as highlighted for bold rendering.
 */
export type HighlightSegment = {
  text: string;
  highlighted: boolean;
};

export function getHighlightedSegments(
  text: string,
  query: string,
): HighlightSegment[] {
  if (!query.trim() || !text) {
    return [{ text, highlighted: false }];
  }

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedQuery})`, "gi");
  const parts = text.split(regex);

  return parts
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      highlighted: regex.test(part) || part.toLowerCase() === query.toLowerCase(),
    }));
}
