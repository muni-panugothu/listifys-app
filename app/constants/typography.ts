/** Reference-style typography (Poppins, forest green headings). */

export const ListifyFonts = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semiBold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
} as const;

export const ListifyTypography = {
  /** Main screen titles — "What's cooking today?" */
  heading: {
    fontFamily: ListifyFonts.bold,
    color: "#1B3022",
  },
  /** Section titles — "Trending Recipe" */
  sectionTitle: {
    fontFamily: ListifyFonts.bold,
    color: "#1B3022",
  },
  /** User / profile name — "Samantha" */
  name: {
    fontFamily: ListifyFonts.medium,
    color: "#1A1A1A",
  },
  /** Welcome label, subtle labels */
  label: {
    fontFamily: ListifyFonts.regular,
    color: "#6B7280",
  },
  /** Body copy */
  body: {
    fontFamily: ListifyFonts.regular,
    color: "#4B5563",
  },
  /** Prices, accents */
  accent: {
    fontFamily: ListifyFonts.semiBold,
    color: "#27BB97",
  },
  /** Category card labels */
  caption: {
    fontFamily: ListifyFonts.medium,
    color: "#374151",
  },
} as const;
