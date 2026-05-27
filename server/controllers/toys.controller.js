const Toy = require("../models/toy.model.js");
const mongoose = require("mongoose");
const { logger } = require("../utils/logger");
const { parsePagination, paginatedFind } = require("../utils/pagination");
const redis = require("../config/redis");
const ListingCache = require("../services/listingcache.service.js");
const S3Service = require("../services/s3.service.js");
const viewCounter = require("../services/viewcount.service.js");
const { esHydratedSearch } = require("../utils/esSearch");
const {
  publishListingCreated,
  publishListingUpdated,
  publishListingDeleted,
  publishImageCleanup,
} = require("../queues/producers/listing.producer");

const LIST_PROJECTION = { currency: 1, slug: 1,
  title: 1,
  description: 1,
  price: 1,
  location: 1,
  condition: 1,
  category: 1,
  subcategory: 1,
  images: 1,
  sellerName: 1,
  seller: 1,
  views: 1,
  features: 1,
  phone: 1,
  status: 1,
  savedBy: 1,
  createdAt: 1,
  brand: 1,
  ageGroup: 1,
  material: 1,
  batteryRequired: 1,
  playMode: 1,
  numberOfPieces: 1,
  characterTheme: 1,
  color: 1,
  coordinates: 1,
};

const normaliseImages = (listing) => {
  if (!listing) return listing;
  if (listing.images) {
    listing.images = listing.images.map((url) => S3Service.toProxyUrl(url));
  }
  if (listing.seller?.profileImage) {
    listing.seller.profileImage = S3Service.toProxyUrl(listing.seller.profileImage);
  }
  return listing;
};

exports.createToy = async (req, res) => {
  try {
    const { lat, lng, ...rest } = req.body;
    const payload = {
      ...rest,
      category: "Toys",
      seller: req.user._id,
      sellerName: req.user.firstName
        ? `${req.user.firstName} ${req.user.lastName || ""}`.trim()
        : req.user.email.split("@")[0],
    };

    if (lat != null && lng != null) {
      payload.coordinates = { type: "Point", coordinates: [lng, lat] };
    }

    const listing = await Toy.create(payload);
    const populated = await Toy.findById(listing._id).populate(
      "seller",
      "name profileImage",
    );

    const listingObj = populated.toObject ? populated.toObject() : populated;
    normaliseImages(listingObj);

    res.status(201).json({
      success: true,
      message: "Toys listing created successfully",
      listing: listingObj,
    });

    publishListingCreated({
      entity: "toys",
      listing: listingObj,
      userId: req.user._id,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    }).catch(() => {});

    return;
  } catch (error) {
    logger.error("Create toys error:", error);
    return res.status(500).json({ success: false, message: "Failed to create toys listing" });
  }
};

exports.getAllToys = async (req, res) => {
  try {
    const {
      search,
      category, // client sends subcategory name as `category`
      condition,
      minPrice,
      maxPrice,
      sort,
      location: locationFilter,
      lat,
      lng,
      radius,
      page = 1,
      limit = 24,
    } = req.query;

    const safeLimit = Math.min(Math.max(Number(limit) || 24, 1), 100);
    const safePage = Math.max(Number(page) || 1, 1);

    const queryKey = [
      search || "",
      category || "",
      condition || "",
      minPrice || "",
      maxPrice || "",
      sort || "newest",
      locationFilter || "",
      lat || "",
      lng || "",
      radius || "",
      page,
      limit,
    ].join("|");

    const cached = await ListingCache.getCachedListingList("toys", queryKey);
    if (cached) {
      if (cached.listings) cached.listings.forEach(normaliseImages);
      res.setHeader("X-Cache", "HIT");
      res.setHeader("X-Cache-Source", "listing-cache");
      res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
      return res.status(200).json({
        success: true,
        listings: cached.listings,
        pagination: cached.pagination,
      });
    }

    // ── Elasticsearch-first search (MongoDB regex fallback below) ──
    if (search && !(lat && lng)) {
      const esResult = await esHydratedSearch({
        entity: 'toys',
        searchParams: { query: search, category: category, condition, minPrice, maxPrice, location: locationFilter, sort, page: safePage, limit: safeLimit },
        Model: Toy,
        projection: LIST_PROJECTION,
      });

      if (esResult) {
        esResult.docs.forEach(normaliseImages);
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Search-Source', 'elasticsearch');
        res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');
        res.status(200).json({ success: true, listings: esResult.docs, pagination: esResult.pagination });

        Promise.all([
          ListingCache.cacheListingList('toys', queryKey, esResult.docs, esResult.pagination),
          ListingCache.prefetchCategoryListings('toys', esResult.docs),
          ListingCache.cacheSearchResults('toys', search, esResult.docs, esResult.pagination),
        ]).catch(err => logger.error('[Cache] Background cache write error:', err.message));
        return;
      }
    }

    const filter = { status: "active" };

    if (search) {
      const escapedSearch = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { title: { $regex: escapedSearch, $options: "i" } },
        { description: { $regex: escapedSearch, $options: "i" } },
      ];
    }
    if (category) {
      const subs = category.split(",").map((s) => s.trim());
      filter.subcategory = { $in: subs };
    }
    if (condition) {
      const conds = condition.split(",").map((c) => c.trim());
      filter.condition = { $in: conds };
    }
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    const { applyGeoFilter, buildSortOption, buildLocationRegex } = require('../utils/geoQuery');
    if (locationFilter) {
      filter.location = buildLocationRegex(locationFilter);
    }
    applyGeoFilter(filter, lat, lng, radius);

    const sortOption = buildSortOption(sort, !!(lat && lng), !!search);

    const skip = (safePage - 1) * safeLimit;

    let listings;
    let pagination;

    if (safePage > 1) {
      listings = await Toy.find(filter, LIST_PROJECTION)
        .sort(sortOption)
        .skip(skip)
        .limit(safeLimit + 1)
        .populate("seller", "name profileImage")
        .lean();

      const hasNextPage = listings.length > safeLimit;
      if (hasNextPage) listings = listings.slice(0, safeLimit);

      pagination = {
        page: safePage,
        limit: safeLimit,
        hasMore: hasNextPage,
      };
    } else {
      const [items, total] = await Promise.all([
        Toy.find(filter, LIST_PROJECTION)
          .sort(sortOption)
          .limit(safeLimit)
          .populate("seller", "name profileImage")
          .lean(),
        Toy.countDocuments(filter),
      ]);
      listings = items;
      pagination = {
        total,
        page: safePage,
        pages: Math.ceil(total / safeLimit),
        limit: safeLimit,
      };
    }

    listings.forEach(normaliseImages);
    res.setHeader("X-Cache", "MISS");
    res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=300");
    res.status(200).json({ success: true, listings, pagination });

    Promise.all([
      ListingCache.cacheListingList("toys", queryKey, listings, pagination),
      ListingCache.prefetchCategoryListings("toys", listings),
      search
        ? ListingCache.cacheSearchResults("toys", search, listings, pagination)
        : null,
    ]).catch((err) =>
      logger.error("[Cache] Background toys cache write error:", err.message),
    );

    return;
  } catch (error) {
    logger.error("Get toys error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch toys" });
  }
};

exports.getToyById = async (req, res) => {
  try {
    const param = req.params.id;
    const isObjectId = mongoose.Types.ObjectId.isValid(param);

    if (isObjectId) {
      const cached = await ListingCache.getCachedListing("toys", param);
      if (cached) {
        viewCounter.recordView("toys", param);
        normaliseImages(cached);
        res.setHeader("X-Cache", "HIT");
        res.setHeader("X-Cache-Source", "listing-cache");
        return res.status(200).json({ success: true, listing: cached });
      }
    }

    const listing = isObjectId
      ? await Toy.findById(param).populate("seller", "name profileImage")
      : await Toy.findOne({ slug: param, status: "active" }).populate("seller", "name profileImage");

    if (!listing || listing.status !== "active") {
      return res.status(404).json({ success: false, message: "Toys listing not found" });
    }

    const listingId = listing._id.toString();
    viewCounter.recordView("toys", listingId);

    const listingObj = listing.toObject();
    normaliseImages(listingObj);

    res.setHeader("X-Cache", "MISS");
    res.status(200).json({ success: true, listing: listingObj });

    ListingCache.cacheListing("toys", listingObj).catch((err) =>
      logger.error("[Cache] Background toys detail cache error:", err.message),
    );

    return;
  } catch (error) {
    logger.error("Get toys by id error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch toys listing" });
  }
};

exports.updateToy = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid listing ID format" });
    }

    const listing = await Toy.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, message: "Toys listing not found" });
    }
    if (listing.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized to update this listing" });
    }

    const incomingImages = Array.isArray(req.body.images) ? req.body.images : null;
    const removedImages = incomingImages
      ? (listing.images || []).filter((img) => !incomingImages.includes(img))
      : [];

    Object.assign(listing, { ...req.body, category: "Toys" });
    await listing.save();

    const updated = await Toy.findById(listing._id).populate(
      "seller",
      "name profileImage",
    );
    const listingObj = updated.toObject();
    normaliseImages(listingObj);

    try {
      await Promise.all([
        ListingCache.cacheListing("toys", listingObj),
        ListingCache.invalidateListCaches("toys"),
      ]);
    } catch (cacheErr) {
      logger.error("[Cache] Toys update cache sync error:", cacheErr.message);
    }

    publishListingUpdated({
      entity: "toys",
      listingId: listing._id,
      userId: req.user._id,
      updates: req.body,
      removedImages,
      newImages: incomingImages || listing.images || [],
      ip: req.ip,
      userAgent: req.get("user-agent"),
    }).catch(() => {});

    if (removedImages.length) {
      publishImageCleanup({
        entity: "toys",
        listingId: listing._id,
        urls: removedImages,
      }).catch(() => {});
    }

    return res.status(200).json({ success: true, listing: listingObj });
  } catch (error) {
    logger.error("Update toys error:", error);
    return res.status(500).json({ success: false, message: "Failed to update toys listing" });
  }
};

exports.deleteToy = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid listing ID format" });
    }

    const listing = await Toy.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, message: "Toys listing not found" });
    }
    if (listing.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized to delete this listing" });
    }

    const listingObj = listing.toObject ? listing.toObject() : listing;
    await listing.deleteOne();

    try {
      await Promise.all([
        ListingCache.invalidateListCaches("toys"),
        ListingCache.invalidateListingCache("toys", req.params.id),
      ]);
    } catch (cacheErr) {
      logger.error("[Cache] Toys delete cache sync error:", cacheErr.message);
    }

    publishListingDeleted({
      entity: "toys",
      listingId: req.params.id,
      userId: req.user._id,
      listing: listingObj,
      images: listingObj.images || [],
      ip: req.ip,
      userAgent: req.get("user-agent"),
    }).catch(() => {});

    return res.status(200).json({ success: true, message: "Toys listing deleted" });
  } catch (error) {
    logger.error("Delete toys error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete toys listing" });
  }
};

exports.getMyToys = async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query, { limit: 20 });
    const { items, pagination } = await paginatedFind({
      model: Toy,
      filter: { seller: req.user._id },
      populate: [{ path: "seller", select: "name profileImage" }],
      page,
      limit,
    });

    items.forEach(normaliseImages);
    return res.status(200).json({ success: true, listings: items, pagination });
  } catch (error) {
    logger.error("Get my toys error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch your toys listings" });
  }
};

exports.getSavedToys = async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query, { limit: 20 });

    const savedKey = `saved:toys:${req.user._id}:p${page}:l${limit}`;
    try {
      const cached = await redis.get(savedKey);
      if (cached) {
        const parsed = typeof cached === "string" ? JSON.parse(cached) : cached;
        if (parsed?.listings) parsed.listings.forEach(normaliseImages);
        res.setHeader("X-Cache", "HIT");
        return res.status(200).json(parsed);
      }
    } catch (cacheErr) {
      logger.debug("Saved toys cache miss:", cacheErr.message);
    }

    const { items, pagination } = await paginatedFind({
      model: Toy,
      filter: { savedBy: req.user._id, status: "active" },
      populate: [{ path: "seller", select: "name profileImage" }],
      page,
      limit,
    });

    items.forEach(normaliseImages);
    try {
      await redis.setex(
        savedKey,
        600,
        JSON.stringify({ success: true, listings: items, pagination }),
      );
    } catch (cacheErr) {
      logger.error("[Cache] Error caching saved toys:", cacheErr.message);
    }

    res.setHeader("X-Cache", "MISS");
    return res.status(200).json({ success: true, listings: items, pagination });
  } catch (error) {
    logger.error("Get saved toys error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch saved toys" });
  }
};

exports.uploadImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "No images provided" });
    }

    const imageUrls = [];
    for (const file of req.files) {
      const result = await S3Service.uploadListingImage(
        file.buffer,
        req.user._id.toString(),
        file.mimetype,
        "toys",
      );
      imageUrls.push(result.imageUrl);
    }

    try {
      await ListingCache.cacheUploadedImages(
        "toys",
        req.user._id.toString(),
        imageUrls,
      );
    } catch (cacheErr) {
      logger.error("[Cache] Error caching uploaded toys images:", cacheErr.message);
    }

    return res.status(200).json({ success: true, imageUrls });
  } catch (error) {
    logger.error("Upload toys images error:", error);
    return res.status(500).json({ success: false, message: "Failed to upload images" });
  }
};

exports.toggleSave = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid listing ID format" });
    }

    const userId = req.user._id;
    const listing = await Toy.findById(req.params.id).select('savedBy').lean();
    if (!listing) {
      return res.status(404).json({ success: false, message: "Toys listing not found" });
    }

    const alreadySaved = listing.savedBy?.some((id) => id.toString() === userId.toString());

    if (alreadySaved) {
      await Toy.updateOne({ _id: req.params.id }, { $pull: { savedBy: userId } });
    } else {
      await Toy.updateOne({ _id: req.params.id }, { $addToSet: { savedBy: userId } });
    }

    try {
      const savedKeyPattern = `saved:toys:${userId}:*`;
      const keys = await redis.keys(savedKeyPattern);
      if (keys?.length) {
        await redis.del(...keys);
      }
      await ListingCache.invalidateListingCache("toys", req.params.id);
    } catch (cacheErr) {
      logger.error("[Cache] Error updating toys save cache:", cacheErr.message);
    }

    return res.status(200).json({
      success: true,
      saved: !alreadySaved,
      message: alreadySaved ? "Removed from saved" : "Saved successfully",
    });
  } catch (error) {
    logger.error("Toggle save toys error:", error);
    return res.status(500).json({ success: false, message: "Failed to toggle save" });
  }
};
