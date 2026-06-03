/**
 * Search Routes — AI-Powered Unified Search (Flipkart/Amazon/OLX-style)
 *
 * Pipeline per request:
 *   1. QueryIntelligenceService  — price/condition/nearMe extraction (minimal; ES handles rest)
 *   2. Elasticsearch (unified)   — multi-strategy retrieval with parsed params
 *   3. MongoDB fallback          — keyword-level OR match when ES is unavailable
 *   4. RankingService            — multi-signal rerank (freshness, distance, engagement)
 *   5. TrendingService           — record analytics, power trending suggestions
 *
 * GET /api/search?q=iphone&entity=electronics&minPrice=100&maxPrice=1000
 * GET /api/search/suggest?q=iph&entity=electronics
 * GET /api/search/trending
 * GET /api/search/recommendations?userId=...
 * POST /api/search/reindex   (admin)
 */

const express = require('express');
const router = express.Router();
const S3Service       = require('../services/s3.service.js');
const SearchService   = require('../services/search.service.js');
const ListingCache    = require('../services/listingcache.service.js');
const QueryIntelligence = require('../services/query-intelligence.service.js');
const RankingService  = require('../services/ranking.service.js');
const TrendingService = require('../services/trending.service.js');
const { searchLimiter } = require('../middleware/ratelimiter.middleware.js');
const { protect, authorize } = require('../middleware/auth.middleware.js');
const { logger } = require('../utils/logger');
const { publishSearchAnalytics } = require('../queues/producers/search.producer');

// Models for MongoDB fallback + reindex
const Electronics    = require('../models/electronics.model.js');
const Job            = require('../models/job.model.js');
const Vehicle        = require('../models/vehicle.model.js');
const Event          = require('../models/event.model.js');
const ForSale        = require('../models/forsale.model.js');
const Furniture      = require('../models/furniture.model.js');
const Fashion        = require('../models/fashion.model.js');
const Sports         = require('../models/sports.model.js');
const Collectible    = require('../models/collectible.model.js');
const Pet            = require('../models/pet.model.js');
const Book           = require('../models/book.model.js');
const Beauty         = require('../models/beauty.model.js');
const Other          = require('../models/other.model.js');
const Toy            = require('../models/toy.model.js');
const Mobile         = require('../models/mobile.model.js');
const Property       = require('../models/property.model.js');
const TakeCare       = require('../models/takecare.model.js');
const ServiceListing = require('../models/servicelisting.model.js');

const MODEL_MAP = {
  electronics: Electronics,
  jobs: Job,
  vehicles: Vehicle,
  events: Event,
  forsale: ForSale,
  furniture: Furniture,
  fashion: Fashion,
  sports: Sports,
  collectibles: Collectible,
  pets: Pet,
  books: Book,
  beauty: Beauty,
  others: Other,
  toys: Toy,
  mobiles: Mobile,
  properties: Property,
  takecare: TakeCare,
  services: ServiceListing,
};

// Normalise image URLs in search results to proxy format so mobile clients
// can display images (raw S3 URLs from Elasticsearch won't be accessible)
function normaliseSearchResult(item) {
  if (!item) return item;
  if (Array.isArray(item.images)) {
    item.images = item.images.map(url => S3Service.toProxyUrl(url) || url);
  }
  if (item.seller && item.seller.profileImage) {
    item.seller.profileImage = S3Service.toProxyUrl(item.seller.profileImage) || item.seller.profileImage;
  }
  return item;
}

// Stop-words stripped before keyword extraction (voice/natural-language queries)
const SEARCH_STOP_WORDS = new Set([
  'i', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'want', 'need', 'buy', 'find', 'search', 'show', 'get', 'sell', 'give',
  'for', 'me', 'a', 'an', 'the', 'of', 'to', 'in', 'at', 'by', 'do',
  'please', 'near', 'nearby', 'some', 'any', 'have', 'has', 'my', 'we',
  'looking', 'good', 'best', 'cheap', 'with', 'and', 'or', 'not', 'on',
  'up', 'out', 'if', 'about', 'who', 'which', 'can', 'will', 'one', 'it',
  'its', 'this', 'that', 'there', 'their', 'them', 'they', 'how', 'what',
]);

/**
 * Extract meaningful search keywords from a query string.
 * Handles voice/natural-language phrases like "I want to buy an iPhone".
 */
function extractSearchKeywords(text) {
  return text
    .toLowerCase()
    .split(/[\s\W]+/)
    .filter(w => w.length > 2 && !SEARCH_STOP_WORDS.has(w));
}

// Entity aliases — used for MongoDB fallback only (ES synonyms handle this in ES path)
const ENTITY_ALIASES = {
  electronics: ['electronic', 'tv', 'laptop', 'computer', 'ac', 'fridge', 'camera', 'appliance'],
  jobs: ['job', 'career', 'hiring', 'vacancy', 'work', 'employment', 'internship'],
  vehicles: ['vehicle', 'car', 'bike', 'cycle', 'motorcycle', 'scooter', 'automobile'],
  events: ['event', 'concert', 'show', 'festival', 'party', 'meetup'],
  forsale: ['for sale', 'sell', 'selling', 'buy', 'deal'],
  furniture: ['sofa', 'table', 'chair', 'bed', 'wardrobe', 'desk', 'shelf', 'cabinet'],
  fashion: ['clothes', 'clothing', 'wear', 'dress', 'shirt', 'shoes', 'footwear', 'watch'],
  sports: ['sport', 'fitness', 'gym', 'exercise', 'cricket', 'football', 'yoga'],
  collectibles: ['collectible', 'antique', 'vintage', 'coin', 'stamp', 'memorabilia'],
  pets: ['pet', 'dog', 'cat', 'puppy', 'kitten', 'bird', 'fish', 'animal'],
  books: ['book', 'novel', 'textbook', 'comic', 'magazine', 'literature', 'reading'],
  beauty: ['makeup', 'skincare', 'cosmetic', 'fragrance', 'perfume', 'hair care'],
  others: ['other', 'miscellaneous', 'misc'],
  toys: ['toy', 'game', 'puzzle', 'doll', 'lego', 'action figure'],
  mobiles: ['mobile', 'phone', 'smartphone', 'tablet', 'iphone', 'samsung', 'android'],
  properties: ['property', 'house', 'apartment', 'flat', 'room', 'rental', 'pg', 'roommate', 'rent', 'bhk', 'villa', 'condo'],
  takecare: ['nanny', 'babysitter', 'caretaker', 'elder care', 'childcare', 'daycare'],
  services: ['service', 'plumber', 'electrician', 'mechanic', 'cleaning', 'repair'],
};

/**
 * Match entities when the query CONTAINS an entity alias.
 * e.g. "used mobile under 20k" → mobiles entity matched via "mobile" alias.
 * This is correct: the word "mobile" means the user wants to browse the
 * mobiles category — product titles like "iPhone 14" don't say "mobile".
 */
function matchEntityNames(query) {
  if (!query) return new Set();
  const q = query.trim().toLowerCase();
  const matched = new Set();
  for (const [entityKey, aliases] of Object.entries(ENTITY_ALIASES)) {
    if (q === entityKey || q === entityKey.replace(/s$/, '') || q === entityKey + 's') {
      matched.add(entityKey);
      continue;
    }
    // q.includes(alias): "used mobile" contains "mobile" → mobiles matched
    if (aliases.some(alias => q === alias || q.includes(alias))) {
      matched.add(entityKey);
    }
  }
  return matched;
}

/**
 * Get entity-alias words that appear in the query string.
 * Used to strip them before doing a product text search within the entity.
 */
function getEntityMatchedWords(query, entityKey) {
  const q = query.toLowerCase();
  const words = new Set();
  const singular = entityKey.replace(/s$/, '');
  for (const candidate of [entityKey, singular]) {
    if (q.includes(candidate)) words.add(candidate);
  }
  for (const alias of (ENTITY_ALIASES[entityKey] || [])) {
    if (q.includes(alias.toLowerCase())) words.add(alias.toLowerCase());
  }
  return words;
}

// Condition-indicator words already extracted into effectiveCondition — no need in text search
const CONDITION_INDICATOR_WORDS = new Set([
  'used', 'old', 'second hand', 'secondhand', '2nd hand',
  'pre-owned', 'preowned', 'refurbished',
  'new', 'brand new', 'sealed', 'unboxed', 'unused',
]);

// Deterministic commerce intent rules.  Elasticsearch is excellent at ranking,
// but marketplace category words like "bike" should be hard filters, otherwise
// vehicle listings such as cars can rank alongside bikes.
const CATALOG_INTENTS = [
  { entity: 'vehicles', category: 'Spare Parts', aliases: ['spare parts', 'vehicle parts', 'car parts', 'bike parts', 'auto parts'] },
  { entity: 'vehicles', category: 'Bikes', aliases: ['bike', 'bikes', 'motorbike', 'motor bike', 'motorcycle', 'motor cycle', 'scooter', 'scooty', 'two wheeler', '2 wheeler'] },
  { entity: 'vehicles', category: 'Cars', aliases: ['car', 'cars', 'automobile', 'auto', 'sedan', 'hatchback', 'suv'] },
  { entity: 'vehicles', category: 'Cycle', aliases: ['cycle', 'cycles', 'bicycle', 'bicycles'] },

  { entity: 'mobiles', category: 'Mobile Phones', aliases: ['mobile', 'mobiles', 'phone', 'phones', 'smartphone', 'smartphones', 'iphone', 'android'] },
  { entity: 'mobiles', category: 'Tablets', aliases: ['tablet', 'tablets', 'ipad'] },
  { entity: 'mobiles', category: 'Chargers & Cables', aliases: ['charger', 'chargers', 'cable', 'cables', 'charging cable'] },
  { entity: 'mobiles', category: 'Earphones & Headphones', aliases: ['earphone', 'earphones', 'headphone', 'headphones', 'earbuds', 'airpods'] },
  { entity: 'mobiles', category: 'Power Banks', aliases: ['power bank', 'powerbank'] },
  { entity: 'mobiles', category: 'Smart Watches & Bands', aliases: ['smart watch', 'smartwatch', 'fitness band'] },

  { entity: 'electronics', category: 'Computers & Laptops', aliases: ['laptop', 'laptops', 'computer', 'computers', 'desktop', 'pc'] },
  { entity: 'electronics', category: 'TVs, Video - Audio', aliases: ['tv', 'television', 'audio', 'speaker', 'speakers', 'home theater'] },
  { entity: 'electronics', category: 'Fridges', aliases: ['fridge', 'fridges', 'refrigerator'] },
  { entity: 'electronics', category: 'Washing Machines', aliases: ['washing machine', 'washer'] },
  { entity: 'electronics', category: 'ACs', aliases: ['ac', 'air conditioner', 'air conditioning'] },
  { entity: 'electronics', category: 'Cameras & Lenses', aliases: ['camera', 'cameras', 'lens', 'lenses', 'dslr'] },

  { entity: 'furniture', category: 'Sofas & Dining', aliases: ['sofa', 'sofas', 'dining'] },
  { entity: 'furniture', category: 'Beds & Wardrobes', aliases: ['bed', 'beds', 'wardrobe', 'wardrobes'] },
  { entity: 'furniture', category: 'Tables & Chairs', aliases: ['table', 'tables', 'chair', 'chairs'] },

  { entity: 'fashion', category: "Men's Clothing", aliases: ['mens clothing', "men's clothing", 'men clothes', 'shirt', 'shirts', 'jeans'] },
  { entity: 'fashion', category: "Women's Clothing", aliases: ['womens clothing', "women's clothing", 'women clothes', 'dress', 'dresses', 'saree', 'kurti'] },
  { entity: 'fashion', category: 'Footwear', aliases: ['shoe', 'shoes', 'footwear', 'sandals', 'sneakers'] },
  { entity: 'fashion', category: 'Watches', aliases: ['watch', 'watches'] },

  { entity: 'properties', category: 'Apartments', aliases: ['apartment', 'apartments', 'flat', 'flats'] },
  { entity: 'properties', category: 'Houses', aliases: ['house', 'houses', 'home', 'villa'] },
  { entity: 'properties', category: 'Single Room', aliases: ['single room', 'room'] },
  { entity: 'properties', category: 'Shared Room', aliases: ['shared room', 'roommate'] },
  { entity: 'properties', category: 'Paying Guest', aliases: ['pg', 'paying guest'] },

  { entity: 'pets', category: 'Dogs', aliases: ['dog', 'dogs', 'puppy', 'puppies'] },
  { entity: 'pets', category: 'Cats', aliases: ['cat', 'cats', 'kitten', 'kittens'] },
  { entity: 'books', category: 'Textbooks', aliases: ['textbook', 'textbooks'] },
  { entity: 'books', category: 'Comics', aliases: ['comic', 'comics'] },
  { entity: 'toys', category: 'Video Games', aliases: ['video game', 'video games', 'gaming'] },
  { entity: 'sports', category: 'Cricket Equipment', aliases: ['cricket bat', 'cricket kit', 'cricket'] },
  { entity: 'sports', category: 'Gym Equipment', aliases: ['gym equipment', 'treadmill', 'dumbbell', 'dumbbells'] },
  { entity: 'beauty', category: 'Makeup', aliases: ['makeup', 'cosmetic', 'cosmetics'] },
  { entity: 'beauty', category: 'Skincare', aliases: ['skincare', 'skin care'] },
  { entity: 'jobs', category: 'IT Jobs', aliases: ['it job', 'software job', 'developer job', 'programmer job'] },
  { entity: 'jobs', category: 'Part Time', aliases: ['part time job', 'part-time job'] },
  { entity: 'services', aliases: ['service', 'services', 'plumber', 'electrician', 'mechanic', 'cleaning', 'repair'] },
  { entity: 'events', aliases: ['event', 'events', 'concert', 'show', 'festival', 'party'] },
  { entity: 'takecare', aliases: ['nanny', 'babysitter', 'elder care', 'caretaker'] },
  { entity: 'collectibles', aliases: ['collectible', 'collectibles', 'antique', 'vintage', 'coin', 'stamp'] },
  { entity: 'others', category: 'Other Items', aliases: ['other items', 'miscellaneous'] },
];

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function aliasRegex(alias) {
  return new RegExp(`(^|[^a-z0-9])${escapeRegex(alias)}([^a-z0-9]|$)`, 'i');
}

function parseCatalogIntent(query, explicitEntity = 'all') {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return { entity: explicitEntity !== 'all' ? explicitEntity : null, category: null, matchedAliases: [] };

  const matches = CATALOG_INTENTS
    .map((intent) => {
      if (explicitEntity !== 'all' && intent.entity !== explicitEntity) return null;
      const alias = intent.aliases
        .slice()
        .sort((a, b) => b.length - a.length)
        .find((candidate) => aliasRegex(candidate.toLowerCase()).test(q));
      return alias ? { ...intent, alias } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.alias.length - a.alias.length);

  if (!matches.length) {
    return { entity: explicitEntity !== 'all' ? explicitEntity : null, category: null, matchedAliases: [] };
  }

  const bestAliasLength = matches[0].alias.length;
  const strongestMatches = matches.filter((m) => m.alias.length === bestAliasLength);
  const entitySet = new Set(strongestMatches.map((m) => m.entity));
  const categorySet = new Set(strongestMatches.map((m) => m.category).filter(Boolean));
  if (entitySet.size > 1 || categorySet.size > 1) {
    return {
      entity: explicitEntity !== 'all' ? explicitEntity : null,
      category: null,
      matchedAliases: matches.map((m) => m.alias),
    };
  }

  return {
    entity: strongestMatches[0].entity,
    category: strongestMatches[0].category || null,
    matchedAliases: matches.map((m) => m.alias),
  };
}

function stripCatalogAliases(text, aliases) {
  let out = String(text || '');
  for (const alias of aliases || []) {
    out = out.replace(aliasRegex(alias), ' ');
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}

function stripWords(text, wordsSet) {
  let result = text;
  for (const word of wordsSet) {
    if (!word) continue;
    const re = new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
    result = result.replace(re, ' ').trim();
  }
  return result.replace(/\s{2,}/g, ' ').trim();
}

// ── Full-text search ──────────────────────────────────────
router.get('/', searchLimiter, async (req, res) => {
  try {
    const {
      q,
      entity = 'all',
      category,
      condition,
      minPrice,
      maxPrice,
      location,
      lat,
      lng,
      brand,
      fuelType,
      transmission,
      sort,
      page = 1,
      limit = 50,
      countryCode,
    } = req.query;

    if (!q && !location && (!lat || !lng)) {
      return res.status(400).json({
        success: false,
        message: 'Either search query (q) or location is required',
      });
    }

    // Validate entity
    if (entity !== 'all' && !MODEL_MAP[entity]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid entity. Use "electronics", "jobs", "vehicles", "events", "forsale", "furniture", "fashion", "sports", "toys", "mobiles", "properties", "takecare", "services", or "all"',
      });
    }

    // ── Step 1: AI Query Intelligence ────────────────────────────────────────
    // Parse natural language, extract price/brand/condition/category hints.
    // Only applied when a text query is present (not pure geo browse).
    const parsed = q
      ? QueryIntelligence.parse(q, { lat, lng })
      : null;

    // Merge explicitly-provided query params with AI-extracted ones.
    // Explicit user params always win over AI inference.
    // Note: brand/location/entity detection is handled by ES natively —
    // the search query is matched against brand/location/_entity fields with
    // fuzzy + synonym expansion. No application-level brand/city mapping needed.
    const effectiveCondition = condition || (parsed?.condition ?? undefined);
    const effectiveMinPrice  = minPrice  || (parsed?.minPrice  != null ? String(parsed.minPrice)  : undefined);
    const effectiveMaxPrice  = maxPrice  || (parsed?.maxPrice  != null ? String(parsed.maxPrice)  : undefined);
    const effectiveBrand     = brand     ?? undefined;   // ES matches brand field natively
    const effectiveLocation  = location  ?? undefined;   // ES matches location field natively
    const catalogIntent = parseCatalogIntent(parsed?.cleanQuery ?? q, entity);
    // Entity/category words become hard filters.  This keeps "bike" scoped to
    // Vehicles/Bikes instead of fuzzy matching cars inside Vehicles.
    const effectiveEntity    = (entity !== 'all') ? entity : (catalogIntent.entity || 'all');
    const effectiveCategory  = category || catalogIntent.category || undefined;
    // Send only remaining product keywords to ES.  A pure category query like
    // "bike" becomes empty and browses the Bikes filter.
    const effectiveQ         = stripCatalogAliases(parsed?.cleanQuery ?? q, catalogIntent.matchedAliases);

    // ── Entity auto-detection — maps query keywords to a single entity ───────
    // Used to return a `detectedEntity` hint so the frontend can auto-switch
    // entity tabs (e.g. "bike" → vehicles, "mobile" → mobiles).
    // Only triggered when entity=all (user didn't explicitly pick a tab).
    const matchedEntities = matchEntityNames(effectiveQ || q || '');
    const detectedEntity = (effectiveEntity === 'all' && matchedEntities.size === 1)
      ? [...matchedEntities][0]
      : (entity === 'all' && catalogIntent.entity ? catalogIntent.entity : null);

    // ── Step 2: Try Redis cache ──────────────────────────────────────────────
    const cacheKeyObj = { v: 2, entity: effectiveEntity, q: effectiveQ, category: effectiveCategory, condition: effectiveCondition, minPrice: effectiveMinPrice, maxPrice: effectiveMaxPrice, location: effectiveLocation, brand: effectiveBrand, fuelType, transmission, sort, page: +page, limit: +limit, countryCode: countryCode || '' };
    const cacheKey = `search:${effectiveEntity}:${Buffer.from(JSON.stringify(cacheKeyObj)).toString('base64url')}`;
    const cachedResults = await ListingCache.getCachedSearchResults(effectiveEntity, cacheKey);
    if (cachedResults) {
      const cachedArray = Array.isArray(cachedResults)
        ? cachedResults
        : cachedResults.results || cachedResults.listings || [];
      cachedArray.forEach(normaliseSearchResult);
      return res.status(200).json({
        success: true,
        query: q,
        entity: effectiveEntity,
        detectedEntity: detectedEntity || undefined,
        results: cachedArray,
        total: cachedResults.pagination?.total || cachedArray.length,
        pagination: cachedResults.pagination,
        source: 'cache',
      });
    }

    // ── 2. Try Elasticsearch (unified index — one query for all entities) ──
    const esResults = await SearchService.search({
      query: effectiveQ,               // use AI/category-cleaned query
      entity: effectiveEntity,          // use AI-suggested entity
      category: effectiveCategory,
      condition: effectiveCondition,
      minPrice: effectiveMinPrice,
      maxPrice: effectiveMaxPrice,
      location: effectiveLocation || location,
      lat,
      lng,
      radius: req.query.radius,
      brand: effectiveBrand || brand,
      fuelType,
      transmission,
      sort,
      page,
      limit,
      countryCode,
    });

    if (esResults && esResults.listings && esResults.listings.length > 0) {
      // Apply AI ranking on top of ES relevance
      const ranked = RankingService.rerank(esResults.listings, {
        maxPrice: effectiveMaxPrice ? Number(effectiveMaxPrice) : null,
        minPrice: effectiveMinPrice ? Number(effectiveMinPrice) : null,
        lat: lat ? Number(lat) : null,
        lng: lng ? Number(lng) : null,
        sort,
      });

      await ListingCache.cacheSearchResults(effectiveEntity, cacheKey, ranked, esResults.pagination);

      // Track analytics + trending (non-blocking)
      if (effectiveQ) {
        TrendingService.recordSearch(effectiveQ, {
          entity: effectiveEntity,
          resultCount: esResults.pagination?.total || ranked.length,
          city: parsed?.location,
        }).catch(() => {});
      }
      publishSearchAnalytics({
        query: q,
        entity: effectiveEntity,
        resultCount: esResults.pagination?.total || ranked.length,
        source: 'elasticsearch',
        userId: req.user?._id?.toString(),
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch(() => {});

      ranked.forEach(normaliseSearchResult);
      return res.status(200).json({
        success: true,
        query: q,
        entity: effectiveEntity,
        detectedEntity: detectedEntity || undefined,
        parsed: parsed ? {
          cleanQuery: effectiveQ,
          chips: parsed.extractedChips,
        } : null,
        results: ranked,
        total: esResults.pagination?.total || ranked.length,
        pagination: esResults.pagination,
        source: 'elasticsearch',
      });
    }

    // ── 3. MongoDB fallback ──
    const entitiesToSearch = effectiveEntity === 'all' ? Object.keys(MODEL_MAP) : [effectiveEntity];
    // matchedEntities already computed above (entity auto-detection)

    const buildMongoFilter = (eName) => {
      const filter = { status: 'active' };

      const qText = effectiveQ;

      if (matchedEntities.has(eName)) {
        // Entity alias found in query (e.g. "mobile" in "used mobile under 20k").
        // The entity word is the category filter — strip it + condition words,
        // then text-search for the remaining product keywords within this entity.
        // e.g. "used mobile" → strip "mobile"(entity) + "used"(condition) → "" → browse all
        // e.g. "iphone mobile" → strip "mobile" → search "iphone" within mobiles
        const entityWords = getEntityMatchedWords(qText, eName);
        let remainingQ = stripWords(qText, entityWords);
        if (effectiveCondition) {
          remainingQ = stripWords(remainingQ, CONDITION_INDICATOR_WORDS);
        }
        remainingQ = remainingQ.trim();

        if (remainingQ.length >= 2) {
          const esc = remainingQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const phraseR = new RegExp(esc, 'i');
          const kws = extractSearchKeywords(remainingQ);
          if (kws.length > 0) {
            const kwConds = kws.flatMap(kw => {
              const r = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
              return [{ title: r }, { brand: r }, { subcategory: r }, { description: r }];
            });
            filter.$or = [{ title: phraseR }, { description: phraseR }, ...kwConds];
          }
        }
        // else: no remaining product text → browse all active in this entity (condition/price still apply)

      } else if (qText) {
        // No entity alias in query — full text search across all meaningful keywords
        const phraseRegex = new RegExp(qText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const keywords = extractSearchKeywords(qText);
        if (keywords.length > 1) {
          const keywordConditions = keywords.flatMap(kw => {
            const r = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            return [{ title: r }, { brand: r }, { subcategory: r }, { description: r }];
          });
          filter.$or = [{ title: phraseRegex }, { description: phraseRegex }, ...keywordConditions];
        } else {
          filter.$or = [
            { title: phraseRegex },
            { description: phraseRegex },
            { category: phraseRegex },
            { subcategory: phraseRegex },
            { brand: phraseRegex },
          ];
        }
      }

      if (effectiveCategory) filter.subcategory = { $in: effectiveCategory.split(',').map(c => c.trim()) };
      // Apply AI-extracted condition if not explicit
      // Normalize to DB enum format: "Used", "New", "Like New", "Good", "Fair"
      const CONDITION_NORM = { used: 'Used', new: 'New', 'like new': 'Like New', good: 'Good', fair: 'Fair' };
      const cond = effectiveCondition;
      if (cond) {
        filter.condition = {
          $in: cond.split(',').map(c => {
            const v = c.trim();
            return CONDITION_NORM[v.toLowerCase()] || v;
          }),
        };
      }
      // AI-extracted price range
      const mxP = effectiveMaxPrice ? Number(effectiveMaxPrice) : null;
      const mnP = effectiveMinPrice ? Number(effectiveMinPrice) : null;
      if (mnP != null || mxP != null) {
        if (eName === 'services') {
          filter['pricing.basePrice'] = {};
          if (mnP != null) filter['pricing.basePrice'].$gte = mnP;
          if (mxP != null) filter['pricing.basePrice'].$lte = mxP;
        } else {
          filter.price = {};
          if (mnP != null) filter.price.$gte = mnP;
          if (mxP != null) filter.price.$lte = mxP;
        }
      }
      const locStr = effectiveLocation || location;
      if (locStr) {
        const locRegex = new RegExp(locStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        if (eName === 'services') {
          filter['location.address'] = locRegex;
        } else {
          filter.location = locRegex;
        }
      }

      const { applyGeoFilter, applyCountryFilter } = require('../utils/geoQuery');
      const radiusKm = req.query.radius || 50;
      if (lat && lng) applyGeoFilter(filter, lat, lng, radiusKm);
      if (countryCode) applyCountryFilter(filter, countryCode);
      return filter;
    };

    const { buildSortOption } = require('../utils/geoQuery');
    const mongoSort = buildSortOption(sort, !!(lat && lng), !!effectiveQ);
    const perEntityLimit = effectiveEntity === 'all' ? Math.min(Number(limit), 20) : Number(limit);
    const skip = effectiveEntity === 'all' ? 0 : (Number(page) - 1) * Number(limit);

    const SEARCH_PROJECTION = 'title slug price images location countryCode condition brand model year fuelType transmission kmDriven mileageUnit seller currency subcategory createdAt views';

    const promises = entitiesToSearch.map(async (eName) => {
      const Model = MODEL_MAP[eName];
      const filter = buildMongoFilter(eName);
      try {
        const docs = await Model.find(filter)
          .select(SEARCH_PROJECTION)
          .sort(mongoSort)
          .skip(skip)
          .limit(perEntityLimit)
          .populate('seller', 'name profileImage')
          .lean();
        return docs.map(d => ({ ...d, _entity: eName }));
      } catch (err) {
        logger.warn(`Search query failed for entity "${eName}":`, err.message);
        return [];
      }
    });

    const arrays = await Promise.all(promises);
    // Apply AI ranking to MongoDB results too
    const rawResults = arrays.flat();
    const results = RankingService.rerank(rawResults, {
      maxPrice: effectiveMaxPrice ? Number(effectiveMaxPrice) : null,
      minPrice: effectiveMinPrice ? Number(effectiveMinPrice) : null,
      lat: lat ? Number(lat) : null,
      lng: lng ? Number(lng) : null,
      sort,
    });

    const pagination = {
      total: results.length,
      page: Number(page),
      pages: 1,
      limit: Number(limit),
    };

    if (results.length > 0) {
      await ListingCache.cacheSearchResults(effectiveEntity, cacheKey, results, pagination);
    }

    // Track analytics + trending (non-blocking)
    if (effectiveQ) {
      TrendingService.recordSearch(effectiveQ, {
        entity: effectiveEntity,
        resultCount: results.length,
      }).catch(() => {});
    }
    publishSearchAnalytics({
      query: q,
      entity: effectiveEntity,
      resultCount: results.length,
      source: 'mongodb',
      userId: req.user?._id?.toString(),
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(() => {});

    results.forEach(normaliseSearchResult);
    return res.status(200).json({
      success: true,
      query: q,
      entity: effectiveEntity,
      detectedEntity: detectedEntity || undefined,
      parsed: parsed ? {
        cleanQuery: effectiveQ,
        chips: parsed.extractedChips,
      } : null,
      results,
      total: results.length,
      pagination,
      source: 'mongodb',
    });
  } catch (error) {
    logger.error('Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed',
    });
  }
});

// ── Trending searches ─────────────────────────────────────
router.get('/trending', searchLimiter, async (req, res) => {
  try {
    const { city, limit = 10 } = req.query;
    const [searches, categories] = await Promise.all([
      city ? TrendingService.getCityTrending(city, Number(limit)) : TrendingService.getGlobalTrending(Number(limit)),
      TrendingService.getTrendingCategories(6),
    ]);
    return res.status(200).json({
      success: true,
      trending: searches,
      categories,
    });
  } catch (err) {
    logger.error('Trending error:', err);
    return res.status(200).json({ success: true, trending: [], categories: [] });
  }
});

// ── Recently viewed + "you might also like" ──────────────
router.get('/recommendations', protect, async (req, res) => {
  try {
    const userId = req.user?._id?.toString();
    const { limit = 12, countryCode } = req.query;

    const [recentlyViewed, mightLike] = await Promise.all([
      TrendingService.getRecentlyViewed(userId, Number(limit)),
      TrendingService.getMightAlsoLike(userId, MODEL_MAP, Number(limit), countryCode),
    ]);

    return res.status(200).json({
      success: true,
      recentlyViewed,
      mightLike,
    });
  } catch (err) {
    logger.error('Recommendations error:', err);
    return res.status(200).json({ success: true, recentlyViewed: [], mightLike: [] });
  }
});

// ── Record a listing view (recently-viewed → Redis, 2-day TTL) ───────────────
// Called by the mobile client whenever a user opens a listing detail screen.
// Uses the authenticated user ID so views are user-scoped.
router.post('/view', protect, async (req, res) => {
  try {
    const userId = req.user?._id?.toString();
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const { _id, _entity, title, price, currency, image } = req.body;
    if (!_id || !_entity) {
      return res.status(400).json({ success: false, message: '_id and _entity are required' });
    }
    // TrendingService.recordView expects item with optional images array or image field
    await TrendingService.recordView(userId, { _id, _entity, title, price, currency, image });
    return res.status(200).json({ success: true });
  } catch (err) {
    logger.error('Record view error:', err);
    return res.status(500).json({ success: false, message: 'Failed to record view' });
  }
});

// ── Similar items for a listing ───────────────────────────
router.get('/similar/:entity/:id', searchLimiter, async (req, res) => {
  try {
    const { entity, id } = req.params;
    const { limit = 10, countryCode } = req.query;

    const Model = MODEL_MAP[entity];
    if (!Model) return res.status(400).json({ success: false, message: 'Invalid entity' });

    const item = await Model.findById(id).lean();
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

    const similar = await TrendingService.getSimilarItems(
      { ...item, _entity: entity },
      MODEL_MAP,
      Number(limit),
      countryCode,
    );

    return res.status(200).json({ success: true, results: similar });
  } catch (err) {
    logger.error('Similar items error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch similar items' });
  }
});

// ── Autocomplete / suggestions ────────────────────────────
router.get('/suggest', searchLimiter, async (req, res) => {
  try {
    const { q, entity = 'all', limit = 8, countryCode } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(200).json({ success: true, suggestions: [] });
    }

    const catalogIntent = parseCatalogIntent(q, entity);
    const effectiveEntity = entity !== 'all' ? entity : (catalogIntent.entity || 'all');
    const effectiveCategory = catalogIntent.category || undefined;
    const effectiveQ = stripCatalogAliases(q, catalogIntent.matchedAliases) || q;

    // 1. Try Elasticsearch (works for both single entity and "all")
    const suggestions = await SearchService.suggest(effectiveQ, {
      entity: effectiveEntity,
      category: effectiveCategory,
      limit: Number(limit),
      countryCode,
    });
    if (suggestions && suggestions.length > 0) {
      return res.status(200).json({
        success: true,
        suggestions,
        source: 'elasticsearch',
      });
    }

    // 2. MongoDB fallback
    const regex = new RegExp(effectiveQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const entitiesToQuery = effectiveEntity === 'all' ? Object.keys(MODEL_MAP) : (MODEL_MAP[effectiveEntity] ? [effectiveEntity] : []);

    if (entitiesToQuery.length === 0) {
      return res.status(200).json({ success: true, suggestions: [] });
    }

    const perEntityLimit = effectiveEntity === 'all' ? Math.max(2, Math.ceil(Number(limit) / entitiesToQuery.length)) : Number(limit);
    const promises = entitiesToQuery.map(async (eName) => {
      try {
        const docs = await MODEL_MAP[eName].find(
          {
            status: 'active',
            ...(countryCode ? { countryCode: countryCode.toUpperCase().trim() } : {}),
            ...(effectiveCategory ? { subcategory: { $in: effectiveCategory.split(',').map(c => c.trim()) } } : {}),
            $or: [
              { title: regex },
              { description: regex },
              { category: regex },
              { subcategory: regex },
              { brand: regex },
            ],
          },
          { title: 1, price: 1, location: 1, images: 1, brand: 1, model: 1, currency: 1, subcategory: 1, slug: 1 }
        ).limit(perEntityLimit).lean();
        return docs.map(r => ({
          _id: r._id,
          title: r.title,
          price: r.price,
          currency: r.currency,
          location: r.location,
          thumbnail: r.images?.[0] || null,
          brand: r.brand,
          model: r.model,
          subcategory: r.subcategory,
          slug: r.slug,
          _entity: eName,
        }));
      } catch (err) { logger.warn(`Suggest failed for "${eName}":`, err.message); return []; }
    });

    const arrays = await Promise.all(promises);
    const mongoSuggestions = arrays.flat().slice(0, Number(limit));

    res.status(200).json({
      success: true,
      suggestions: mongoSuggestions,
      source: 'mongodb',
    });
  } catch (error) {
    logger.error('Suggest error:', error);
    res.status(200).json({ success: true, suggestions: [] });
  }
});

// ── Reindex: sync MongoDB → Elasticsearch ─────────────────
router.post('/reindex', protect, authorize('admin'), async (req, res) => {
  try {
    if (!SearchService.isAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'Elasticsearch is not connected. Set ELASTICSEARCH_URL env var.',
      });
    }

    const { entity } = req.body;
    const entities = entity ? [entity] : Object.keys(MODEL_MAP);
    const results = {};

    for (const ent of entities) {
      const Model = MODEL_MAP[ent];
      if (!Model) continue;

      const listings = await Model.find({ status: 'active' }).lean();
      const result = await SearchService.bulkIndex(ent, listings);
      results[ent] = { total: listings.length, ...result };
    }

    res.status(200).json({
      success: true,
      message: 'Reindex complete',
      results,
    });
  } catch (error) {
    logger.error('Reindex error:', error);
    res.status(500).json({
      success: false,
      message: 'Reindex failed',
    });
  }
});

// ── Trending / Popular searches ───────────────────────────
router.get('/trending', searchLimiter, async (req, res) => {
  try {
    const { limit = 12 } = req.query;

    // 1. Try Redis cache
    const cacheKey = 'search:trending';
    const cached = await ListingCache.getCachedSearchResults('trending', cacheKey);
    if (cached) {
      return res.status(200).json({
        success: true,
        trending: Array.isArray(cached) ? cached : cached.results || [],
        source: 'cache',
      });
    }

    // 2. Aggregate popular searches from recently created listings across all entities
    const trendingItems = [];

    // Get recently created listings and extract popular subcategories + titles
    const popularPromises = Object.entries(MODEL_MAP).map(async ([eName, Model]) => {
      try {
        const docs = await Model.find({ status: 'active' })
          .sort({ views: -1, createdAt: -1 })
          .select('title subcategory category brand images price location')
          .limit(Math.ceil(Number(limit) / Object.keys(MODEL_MAP).length) + 1)
          .lean();
        return docs.map(d => ({
          _id: d._id,
          title: d.title,
          subcategory: d.subcategory,
          category: d.category,
          brand: d.brand,
          thumbnail: d.images?.[0] || null,
          price: d.price,
          location: d.location,
          _entity: eName,
        }));
      } catch { return []; }
    });

    const arrays = await Promise.all(popularPromises);
    trendingItems.push(...arrays.flat());

    // Sort by some "trending" heuristic (views would be ideal, but we have limited data)
    const trending = trendingItems.slice(0, Number(limit));

    // Cache for 10 min
    if (trending.length > 0) {
      await ListingCache.cacheSearchResults('trending', cacheKey, trending, { total: trending.length });
    }

    res.status(200).json({
      success: true,
      trending,
      source: 'mongodb',
    });
  } catch (error) {
    logger.error('Trending error:', error);
    res.status(200).json({ success: true, trending: [] });
  }
});

// ── Trending Search Terms (from analytics) ────────────────
router.get('/trending-terms', searchLimiter, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const mongoose = require('mongoose');

    if (!mongoose.models.SearchAnalytics) {
      return res.status(200).json({ success: true, terms: [] });
    }

    const SearchAnalytics = mongoose.models.SearchAnalytics;
    const terms = await SearchAnalytics.find({
      searchCount: { $gte: 3 }, // Minimum 3 searches
      lastSearched: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
    })
      .sort({ searchCount: -1 })
      .limit(Number(limit))
      .select('query searchCount entity -_id')
      .lean();

    res.status(200).json({ success: true, terms });
  } catch (error) {
    logger.error('Trending terms error:', error);
    res.status(200).json({ success: true, terms: [] });
  }
});

// ── Elasticsearch status ──────────────────────────────────
router.get('/status', protect, authorize('admin'), async (req, res) => {
  res.status(200).json({
    success: true,
    elasticsearch: {
      connected: SearchService.isAvailable(),
      fallback: 'MongoDB regex search',
    },
  });
});

// ── Dynamic categories with live subcategories from DB ────────────────────────
//
// Production-level (Flipkart / Amazon style): subcategories are aggregated
// directly from the DB so any new subcategory added to a model's enum — or
// posted by a seller — is surfaced in the app automatically, with ZERO code
// changes required.
//
// In-memory cache (10 min TTL) avoids hitting the DB on every app open.
// The cache is invalidated on server restart, which is fine for this data.

let _subcatCache = null;       // { entity: string; subcategories: string[] }[]
let _subcatCacheExpiry = 0;    // epoch ms
const SUBCAT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * GET /api/search/categories
 *
 * Returns all categories with their subcategories fetched live from the DB.
 * Response:
 *   { success: true, categories: [ { entity, subcategories: string[] }, … ], source: 'cache'|'mongodb' }
 */
router.get('/categories', searchLimiter, async (req, res) => {
  try {
    // Serve from in-memory cache when fresh
    if (_subcatCache && Date.now() < _subcatCacheExpiry) {
      return res.status(200).json({
        success: true,
        categories: _subcatCache,
        source: 'cache',
      });
    }

    // Fan-out: query every collection for its distinct active subcategories
    const results = await Promise.all(
      Object.entries(MODEL_MAP).map(async ([entity, Model]) => {
        try {
          // distinct() is a MongoDB index scan — fast even on large collections
          const raw = await Model.distinct('subcategory', { status: 'active' });
          const subcategories = raw
            .filter((s) => typeof s === 'string' && s.trim().length > 0)
            .map((s) => s.trim())
            .sort((a, b) => a.localeCompare(b));
          return { entity, subcategories };
        } catch (err) {
          logger.warn(`categories: distinct failed for "${entity}":`, err.message);
          return { entity, subcategories: [] };
        }
      }),
    );

    // Populate cache
    _subcatCache = results;
    _subcatCacheExpiry = Date.now() + SUBCAT_CACHE_TTL_MS;

    return res.status(200).json({
      success: true,
      categories: results,
      source: 'mongodb',
    });
  } catch (error) {
    logger.error('Categories fetch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
    });
  }
});

// Export MODEL_MAP for use in server.js (background reindex + change streams)
router.MODEL_MAP = MODEL_MAP;

module.exports = router;
