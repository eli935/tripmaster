import type { AttractionCategory } from "./destinations";

/**
 * Category-based Unsplash fallback URLs for attractions missing an `image`.
 * Uses featured/curated Unsplash photos that are stable and well-known.
 * All are `?w=600&q=75&auto=format` to match the site's existing pattern.
 */
const CATEGORY_FALLBACKS: Record<AttractionCategory, string> = {
  nature:    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&q=75&auto=format",
  historic:  "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=600&q=75&auto=format",
  beach:     "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=75&auto=format",
  museum:    "https://images.unsplash.com/photo-1565060169861-2e2267d2a6c4?w=600&q=75&auto=format",
  activity:  "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=600&q=75&auto=format",
  viewpoint: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=600&q=75&auto=format",
  religious: "https://images.unsplash.com/photo-1548276145-69a9521f0499?w=600&q=75&auto=format",
  kids:      "https://images.unsplash.com/photo-1596495577886-d920f1fb7238?w=600&q=75&auto=format",
};

const GENERIC_TRAVEL =
  "https://images.unsplash.com/photo-1488085061387-422e29b40080?w=600&q=75&auto=format";

/**
 * Resolve an image URL for an attraction / booking. Never returns empty —
 * falls back first to the category-appropriate Unsplash photo, then to a
 * generic travel photo. This fixes the "some images show, some don't" issue.
 */
export function resolveAttractionImage(
  image: string | null | undefined,
  category?: string | null
): string {
  if (image && image.trim().length > 0) return image;
  if (category && category in CATEGORY_FALLBACKS) {
    return CATEGORY_FALLBACKS[category as AttractionCategory];
  }
  return GENERIC_TRAVEL;
}
