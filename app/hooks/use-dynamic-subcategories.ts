/**
 * useDynamicSubcategories
 *
 * Fetches subcategories for a given entity from the live database via
 * GET /api/search/categories, then falls back to the static list in
 * @/constants/categories when the network is unavailable.
 *
 * This is the production pattern used by Flipkart/Amazon:
 *   - Subcategory list is driven by what actually exists in the DB
 *   - Adding a new subcategory in the model immediately surfaces in the app
 *   - No code change or app release required
 *
 * The API response is cached for 10 minutes (matching the server-side cache),
 * so subsequent renders within the same app session pay zero network cost.
 */

import { useEffect, useRef, useState } from "react";
import { CATEGORY_MAP, type CategorySlug } from "@/constants/categories";
import { fetchCategories } from "@/features/search/services/search-api";

type State = {
  subcategories: string[];  // Always includes "All" as first item
  loading: boolean;
};

/**
 * @param categorySlug  - e.g. "vehicles", "mobiles", …
 * @returns { subcategories, loading }
 *   subcategories — ["All", "Cars", "Bikes", …]  (DB-driven, static fallback)
 *   loading       — true only on the initial fetch before any data is available
 */
export function useDynamicSubcategories(categorySlug: CategorySlug): State {
  // Static fallback from local constants (used while loading or on error)
  const staticSubcats = CATEGORY_MAP[categorySlug]?.subcategories ?? [];
  const initialSubcats = ["All", ...staticSubcats];

  const [subcategories, setSubcategories] = useState<string[]>(initialSubcats);
  const [loading, setLoading] = useState(true);

  // Avoid setting state after unmount
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const all = await fetchCategories();
        if (cancelled || !mounted.current) return;

        const entry = all.find((c) => c.entity === categorySlug);

        if (entry) {
          // Merge strategy:
          //   1. Always show the full static list (preserves defined order)
          //   2. Append any DB-only subcategories that don't exist in the
          //      static list yet (e.g. a new subcategory added to the model
          //      before someone updates categories.ts)
          // This means every defined subcategory is always visible even when
          // zero listings have been posted with it.
          const staticSet = new Set(staticSubcats);
          const dbOnly = entry.subcategories.filter((s) => !staticSet.has(s));
          setSubcategories(["All", ...staticSubcats, ...dbOnly]);
        } else {
          // Entity not found in DB response — keep full static list
          setSubcategories(initialSubcats);
        }
      } catch {
        // Network error — keep static list, no crash
        if (!cancelled && mounted.current) {
          setSubcategories(initialSubcats);
        }
      } finally {
        if (!cancelled && mounted.current) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => { cancelled = true; };
    // Re-fetch when category changes; fetchCategories is cached so no extra cost
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorySlug]);

  return { subcategories, loading };
}
