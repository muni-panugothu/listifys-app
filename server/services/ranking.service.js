'use strict';
/**
 * AI Ranking Service — Multi-Signal Result Reranker
 *
 * After Elasticsearch / MongoDB returns results, this service applies
 * additional marketplace-specific signals to improve relevance ordering.
 *
 * Signals (all normalised to 0–1 and combined via weighted sum):
 *   1. ES/Mongo relevance  — raw retrieval score (0-1, normalised)
 *   2. Freshness           — newer listings rank higher
 *   3. Distance            — closer listings rank higher (if lat/lng given)
 *   4. Price fit           — how well the item price matches user budget
 *   5. Engagement          — views / saves proxy for popularity
 *   6. Image quality       — listings with images rank above image-less ones
 *   7. Completeness        — listings with description + location rank higher
 *
 * The weights are tuned for a local used-goods marketplace (OLX / OfferUp
 * style) rather than a pure e-commerce retailer.
 */

'use strict';

const WEIGHTS = {
  relevance:   0.35,
  freshness:   0.20,
  distance:    0.15,
  priceFit:    0.12,
  engagement:  0.10,
  imageQuality:0.05,
  completeness:0.03,
};

class RankingService {

  /**
   * Rerank a list of search results using multi-signal scoring.
   *
   * @param {Array}  results   Raw result objects from ES / MongoDB
   * @param {Object} context   { maxPrice, minPrice, lat, lng, query, sort }
   * @returns {Array}          Reranked results (same objects, new order)
   */
  static rerank(results, context = {}) {
    if (!results || results.length === 0) return results;

    // Don't rerank when user explicitly chose a sort (respect explicit intent)
    if (context.sort && context.sort !== 'relevance') return results;

    const scored = results.map((item) => ({
      item,
      score: this._computeScore(item, results, context),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.item);
  }

  // ─────────────────────────────────────────────────────────────
  //  Combined score
  // ─────────────────────────────────────────────────────────────
  static _computeScore(item, allResults, ctx) {
    const s = {
      relevance:    this._relevanceScore(item, allResults),
      freshness:    this._freshnessScore(item),
      distance:     this._distanceScore(item, ctx),
      priceFit:     this._priceFitScore(item, ctx, allResults),
      engagement:   this._engagementScore(item),
      imageQuality: this._imageScore(item),
      completeness: this._completenessScore(item),
    };

    return Object.keys(WEIGHTS).reduce(
      (total, key) => total + s[key] * WEIGHTS[key],
      0,
    );
  }

  // ─────────────────────────────────────────────────────────────
  //  Signal 1: Normalised retrieval relevance
  // ─────────────────────────────────────────────────────────────
  static _relevanceScore(item, allResults) {
    const rawScore = item._score ?? 0;
    if (rawScore === 0) return 0.3; // Treat MongoDB results (no score) as mid-tier

    const maxScore = Math.max(...allResults.map(r => r._score ?? 0));
    return maxScore > 0 ? Math.min(rawScore / maxScore, 1) : 0.5;
  }

  // ─────────────────────────────────────────────────────────────
  //  Signal 2: Freshness — exponential decay by age
  // ─────────────────────────────────────────────────────────────
  static _freshnessScore(item) {
    if (!item.createdAt) return 0.2;

    const ageMs  = Date.now() - new Date(item.createdAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    if (ageDays < 1)   return 1.00;
    if (ageDays < 3)   return 0.90;
    if (ageDays < 7)   return 0.75;
    if (ageDays < 14)  return 0.60;
    if (ageDays < 30)  return 0.45;
    if (ageDays < 90)  return 0.30;
    if (ageDays < 180) return 0.20;
    return 0.10;
  }

  // ─────────────────────────────────────────────────────────────
  //  Signal 3: Geographic distance
  // ─────────────────────────────────────────────────────────────
  static _distanceScore(item, ctx) {
    if (!ctx.lat || !ctx.lng) return 0.5; // Neutral when no location

    // ES distance is already attached when sort=nearest
    const distKm = item.distance != null
      ? item.distance
      : this._haversineKm(ctx.lat, ctx.lng, item);

    if (distKm == null) return 0.3;

    // Score: 1.0 at 0 km, ~0.5 at 10 km, ~0.2 at 50 km
    return Math.max(0, 1 / (1 + distKm / 8));
  }

  static _haversineKm(lat1, lng1, item) {
    // Coordinates from ES are stored as [lng, lat]
    let lat2, lng2;
    if (Array.isArray(item.coordinates) && item.coordinates.length === 2) {
      [lng2, lat2] = item.coordinates;
    } else {
      return null;
    }
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
            + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
            * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ─────────────────────────────────────────────────────────────
  //  Signal 4: Price fit — how well item price matches user budget
  // ─────────────────────────────────────────────────────────────
  static _priceFitScore(item, ctx, allResults) {
    const price = Number(item.price);
    if (isNaN(price) || price <= 0) return 0.4;

    // If user specified a max price, reward items that are priced well within budget
    if (ctx.maxPrice) {
      const ratio = price / ctx.maxPrice;
      if (ratio <= 0.5)  return 1.0;   // 50% of budget or less — great value
      if (ratio <= 0.75) return 0.85;
      if (ratio <= 0.90) return 0.70;
      if (ratio <= 1.00) return 0.55;
      return 0.10; // above budget (shouldn't be in results, but safety net)
    }

    // No budget specified — use median price of results to infer competitiveness
    const prices = allResults
      .map(r => Number(r.price))
      .filter(p => !isNaN(p) && p > 0)
      .sort((a, b) => a - b);

    if (prices.length < 2) return 0.5;

    const median = prices[Math.floor(prices.length / 2)];
    const ratio  = price / median;

    if (ratio <= 0.5)  return 0.90;  // Much cheaper than median
    if (ratio <= 0.8)  return 0.75;
    if (ratio <= 1.2)  return 0.60;  // Near median
    if (ratio <= 2.0)  return 0.40;
    return 0.20;
  }

  // ─────────────────────────────────────────────────────────────
  //  Signal 5: Engagement — views / saves as popularity proxy
  // ─────────────────────────────────────────────────────────────
  static _engagementScore(item) {
    const views = Number(item.views ?? 0);
    const saves = Number(item.savedBy?.length ?? 0);

    // Log scale: saturates at ~100 views and ~20 saves
    const viewScore = views > 0 ? Math.min(Math.log10(views + 1) / 3, 1) : 0;
    const saveScore = saves > 0 ? Math.min(Math.log10(saves * 5 + 1) / 3, 1) : 0;

    return viewScore * 0.6 + saveScore * 0.4;
  }

  // ─────────────────────────────────────────────────────────────
  //  Signal 6: Image quality — penalise listings with no images
  // ─────────────────────────────────────────────────────────────
  static _imageScore(item) {
    const imgs = Array.isArray(item.images) ? item.images : [];
    if (imgs.length === 0) return 0;
    if (imgs.length === 1) return 0.4;
    if (imgs.length <= 3)  return 0.7;
    return 1.0;
  }

  // ─────────────────────────────────────────────────────────────
  //  Signal 7: Listing completeness
  // ─────────────────────────────────────────────────────────────
  static _completenessScore(item) {
    let score = 0;
    if (item.title?.length > 10)       score += 0.25;
    if (item.description?.length > 30) score += 0.35;
    if (item.location)                 score += 0.25;
    if (item.price != null)            score += 0.15;
    return score;
  }
}

module.exports = RankingService;
