const Fashion = require("../models/fashion.model.js");
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
  size: 1,
  gender: 1,
  fabricType: 1,
  color: 1,
  coordinates: 1,
  countryCode: 1,
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

exports.createFashion = async (req, res) => {
  try {
    const {
      lat,
      lng,
      ...rest
    } = req.body;

    const payload = {
      ...rest,
      category: "Fashion",
      seller: req.user._id,
      sellerName: req.user.firstName
        ? `${req.user.firstName} ${req.user.lastName || ""}`.trim()
        : req.user.email.split("@")[0],
      ...(lat && lng && {
        coordinates: { type: "Point", coordinates: [Number(lng), Number(lat)] },
      }),
    };

    const listing = await Fashion.create(payload);
    const populated = await Fashion.findById(listing._id).populate(
      "seller",
      "name profileImage",
    );

    const listingObj = populated.toObject ? populated.toObject() : populated;
    normaliseImages(listingObj);

    res.status(201).json({
      success: true,
      message: "Fashion listing created successfully",
      listing: listingObj,
    });

    publishListingCreated({
      entity: "fashion",
      listing: listingObj,
      userId: req.user._id,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    }).catch(() => {});

    return;
  } catch (error) {
    logger.error("Create fashion error:", error);
    return res.status(500).json({ success: false, message: "Failed to create fashion listing" });
  }
};

exports.getAllFashion = async (req, res) => {
  try {
    const {
      search,
      category,
      condition,
      minPrice,
      maxPrice,
      sort,
      location: locationFilter,
      lat,
      lng,
      radius,
      countryCode,
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
      countryCode || "",
      page,
      limit,
    ].join("|");

    const cached = await ListingCache.getCachedListingList("fashion", queryKey);
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
        entity: 'fashion',
        searchParams: { query: search, category: category, condition, minPrice, maxPrice, location: locationFilter, sort, page: safePage, limit: safeLimit },
        Model: Fashion,
        projection: LIST_PROJECTION,
      });

      if (esResult) {
        esResult.docs.forEach(normaliseImages);
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Search-Source', 'elasticsearch');
        res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');
        res.status(200).json({ success: true, listings: esResult.docs, pagination: esResult.pagination });

        Promise.all([
          ListingCache.cacheListingList('fashion', queryKey, esResult.docs, esResult.pagination),
          ListingCache.prefetchCategoryListings('fashion', esResult.docs),
          ListingCache.cacheSearchResults('fashion', search, esResult.docs, esResult.pagination),
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
      filter.subcategory = { $in: category.split(",").map((s) => s.trim()) };
    }
    if (condition) {
      filter.condition = { $in: condition.split(",").map((c) => c.trim()) };
    }
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    const { applyGeoFilter, buildSortOption, buildLocationRegex, applyCountryFilter } = require('../utils/geoQuery');
    if (locationFilter) {
      filter.location = buildLocationRegex(locationFilter);
    }
    applyGeoFilter(filter, lat, lng, radius);
    applyCountryFilter(filter, countryCode);

    const sortOption = buildSortOption(sort, !!(lat && lng), !!search);

    const skip = (safePage - 1) * safeLimit;

    let listings;
    let pagination;

    if (safePage > 1) {
      listings = await Fashion.find(filter, LIST_PROJECTION)
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
        Fashion.find(filter, LIST_PROJECTION)
          .sort(sortOption)
          .limit(safeLimit)
          .populate("seller", "name profileImage")
          .lean(),
        Fashion.countDocuments(filter),
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
      ListingCache.cacheListingList("fashion", queryKey, listings, pagination),
      ListingCache.prefetchCategoryListings("fashion", listings),
      search
        ? ListingCache.cacheSearchResults("fashion", search, listings, pagination)
        : null,
    ]).catch((err) =>
      logger.error("[Cache] Background fashion cache write error:", err.message),
    );

    return;
  } catch (error) {
    logger.error("Get fashion error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch fashion" });
  }
};

exports.getFashionById = async (req, res) => {
  try {
    const param = req.params.id;
    const isObjectId = mongoose.Types.ObjectId.isValid(param);

    if (isObjectId) {
      const cached = await ListingCache.getCachedListing("fashion", param);
      if (cached) {
        viewCounter.recordView("fashion", param);
        normaliseImages(cached);
        res.setHeader("X-Cache", "HIT");
        res.setHeader("X-Cache-Source", "listing-cache");
        return res.status(200).json({ success: true, listing: cached });
      }
    }

    const listing = isObjectId
      ? await Fashion.findById(param).populate("seller", "name profileImage")
      : await Fashion.findOne({ slug: param, status: "active" }).populate("seller", "name profileImage");

    if (!listing || listing.status !== "active") {
      return res.status(404).json({ success: false, message: "Fashion listing not found" });
    }

    const listingId = listing._id.toString();
    viewCounter.recordView("fashion", listingId);

    const listingObj = listing.toObject();
    normaliseImages(listingObj);

    res.setHeader("X-Cache", "MISS");
    res.status(200).json({ success: true, listing: listingObj });

    ListingCache.cacheListing("fashion", listingObj).catch((err) =>
      logger.error("[Cache] Background fashion detail cache error:", err.message),
    );

    return;
  } catch (error) {
    logger.error("Get fashion by id error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch fashion listing" });
  }
};

exports.updateFashion = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid listing ID format" });
    }

    const listing = await Fashion.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, message: "Fashion listing not found" });
    }
    if (listing.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized to update this listing" });
    }

    const incomingImages = Array.isArray(req.body.images) ? req.body.images : null;
    const removedImages = incomingImages
      ? (listing.images || []).filter((img) => !incomingImages.includes(img))
      : [];

    Object.assign(listing, { ...req.body, category: "Fashion" });
    await listing.save();

    const updated = await Fashion.findById(listing._id).populate(
      "seller",
      "name profileImage",
    );
    const listingObj = updated.toObject();
    normaliseImages(listingObj);

    try {
      await Promise.all([
        ListingCache.cacheListing("fashion", listingObj),
        ListingCache.invalidateListCaches("fashion"),
      ]);
    } catch (cacheErr) {
      logger.error("[Cache] Fashion update cache sync error:", cacheErr.message);
    }

    publishListingUpdated({
      entity: "fashion",
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
        entity: "fashion",
        listingId: listing._id,
        urls: removedImages,
      }).catch(() => {});
    }

    return res.status(200).json({ success: true, listing: listingObj });
  } catch (error) {
    logger.error("Update fashion error:", error);
    return res.status(500).json({ success: false, message: "Failed to update fashion listing" });
  }
};

exports.deleteFashion = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid listing ID format" });
    }

    const listing = await Fashion.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, message: "Fashion listing not found" });
    }
    if (listing.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized to delete this listing" });
    }

    const listingObj = listing.toObject ? listing.toObject() : listing;
    await listing.deleteOne();

    try {
      await Promise.all([
        ListingCache.invalidateListCaches("fashion"),
        ListingCache.invalidateListingCache("fashion", req.params.id),
      ]);
    } catch (cacheErr) {
      logger.error("[Cache] Fashion delete cache sync error:", cacheErr.message);
    }

    publishListingDeleted({
      entity: "fashion",
      listingId: req.params.id,
      userId: req.user._id,
      listing: listingObj,
      images: listingObj.images || [],
      ip: req.ip,
      userAgent: req.get("user-agent"),
    }).catch(() => {});

    return res.status(200).json({ success: true, message: "Fashion listing deleted" });
  } catch (error) {
    logger.error("Delete fashion error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete fashion listing" });
  }
};

exports.getMyFashion = async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query, { limit: 20 });
    const { items, pagination } = await paginatedFind({
      model: Fashion,
      filter: { seller: req.user._id },
      populate: [{ path: "seller", select: "name profileImage" }],
      page,
      limit,
    });

    items.forEach(normaliseImages);
    return res.status(200).json({ success: true, listings: items, pagination });
  } catch (error) {
    logger.error("Get my fashion error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch your fashion listings" });
  }
};

exports.getSavedFashion = async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query, { limit: 20 });

    const savedKey = `saved:fashion:${req.user._id}:p${page}:l${limit}`;
    try {
      const cached = await redis.get(savedKey);
      if (cached) {
        const parsed = typeof cached === "string" ? JSON.parse(cached) : cached;
        if (parsed?.listings) parsed.listings.forEach(normaliseImages);
        res.setHeader("X-Cache", "HIT");
        return res.status(200).json(parsed);
      }
    } catch (cacheErr) {
      logger.warn("Saved fashion cache read failed", { error: cacheErr.message });
    }

    const { items, pagination } = await paginatedFind({
      model: Fashion,
      filter: { savedBy: req.user._id, status: "active" },
      populate: [{ path: "seller", select: "name profileImage" }],
      page,
      limit,
    });

    items.forEach(normaliseImages);

    const payload = { success: true, listings: items, pagination };
    try {
      await redis.set(savedKey, JSON.stringify(payload), { ex: 300 });
    } catch (cacheErr) {
      logger.warn("Saved fashion cache write failed", { error: cacheErr.message });
    }

    return res.status(200).json(payload);
  } catch (error) {
    logger.error("Get saved fashion error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch saved fashion" });
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
        "fashion",
      );
      imageUrls.push(result.imageUrl);
    }

    try {
      await ListingCache.cacheUploadedImages(
        "fashion",
        req.user._id.toString(),
        imageUrls,
      );
    } catch (cacheErr) {
      logger.error("[Cache] Error caching uploaded fashion images:", cacheErr.message);
    }

    return res.status(200).json({ success: true, imageUrls });
  } catch (error) {
    logger.error("Fashion image upload error:", error);
    return res.status(500).json({ success: false, message: "Failed to upload images" });
  }
};

exports.toggleSave = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid listing ID format" });
    }

    const userId = req.user._id;
    const listing = await Fashion.findById(req.params.id).select('savedBy status').lean();
    if (!listing || listing.status !== "active") {
      return res.status(404).json({ success: false, message: "Fashion listing not found" });
    }

    const alreadySaved = listing.savedBy?.some(
      (savedId) => savedId.toString() === userId.toString(),
    );

    if (alreadySaved) {
      await Fashion.updateOne({ _id: req.params.id }, { $pull: { savedBy: userId } });
    } else {
      await Fashion.updateOne({ _id: req.params.id }, { $addToSet: { savedBy: userId } });
    }

    try {
      await Promise.all([
        ListingCache.invalidateListingCache("fashion", req.params.id),
        redis.del(`saved:fashion:${userId}:p1:l20`),
      ]);
    } catch (cacheErr) {
      logger.warn("Fashion save cache invalidation failed", { error: cacheErr.message });
    }

    return res.status(200).json({ success: true, saved: !alreadySaved });
  } catch (error) {
    logger.error("Toggle save fashion error:", error);
    return res.status(500).json({ success: false, message: "Failed to update saved listing" });
  }
};
