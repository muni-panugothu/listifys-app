const Sports = require("../models/sports.model.js");
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

const LIST_PROJECTION = {
  currency: 1,
  slug: 1,
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
  sportType: 1,
  size: 1,
  material: 1,
  color: 1,
  weight: 1,
  ageGroup: 1,
  coordinates: 1,
};

const normaliseImages = (listing) => {
  if (!listing) return listing;
  if (listing.images) {
    listing.images = listing.images.map((url) => S3Service.toProxyUrl(url));
  }
  if (listing.seller?.profileImage) {
    listing.seller.profileImage = S3Service.toProxyUrl(
      listing.seller.profileImage,
    );
  }
  return listing;
};

exports.createSports = async (req, res) => {
  try {
    const payload = {
      ...req.body,
      category: "Sports",
      seller: req.user._id,
      sellerName: req.user.firstName
        ? `${req.user.firstName} ${req.user.lastName || ""}`.trim()
        : req.user.email.split("@")[0],
    };

    const listing = await Sports.create(payload);
    const populated = await Sports.findById(listing._id).populate(
      "seller",
      "name profileImage",
    );

    const listingObj = populated.toObject ? populated.toObject() : populated;
    normaliseImages(listingObj);

    res.status(201).json({
      success: true,
      message: "Sports listing created successfully",
      listing: listingObj,
    });

    publishListingCreated({
      entity: "sports",
      listing: listingObj,
      userId: req.user._id,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    }).catch(() => {});

    return;
  } catch (error) {
    logger.error("Create sports error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create sports listing" });
  }
};

exports.getAllSports = async (req, res) => {
  try {
    const {
      search,
      subcategory,
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
      subcategory || "",
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

    const cached = await ListingCache.getCachedListingList("sports", queryKey);
    if (cached) {
      if (cached.listings) cached.listings.forEach(normaliseImages);
      res.setHeader("X-Cache", "HIT");
      res.setHeader("X-Cache-Source", "listing-cache");
      res.setHeader(
        "Cache-Control",
        "public, max-age=60, stale-while-revalidate=300",
      );
      return res.status(200).json({
        success: true,
        listings: cached.listings,
        pagination: cached.pagination,
      });
    }

    // ── Elasticsearch-first search (MongoDB regex fallback below) ──
    if (search && !(lat && lng)) {
      const esResult = await esHydratedSearch({
        entity: 'sports',
        searchParams: { query: search, category: subcategory, condition, minPrice, maxPrice, location: locationFilter, sort, page: safePage, limit: safeLimit },
        Model: Sports,
        projection: LIST_PROJECTION,
      });

      if (esResult) {
        esResult.docs.forEach(normaliseImages);
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Search-Source', 'elasticsearch');
        res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=300');
        res.status(200).json({ success: true, listings: esResult.docs, pagination: esResult.pagination });

        Promise.all([
          ListingCache.cacheListingList('sports', queryKey, esResult.docs, esResult.pagination),
          ListingCache.prefetchCategoryListings('sports', esResult.docs),
          ListingCache.cacheSearchResults('sports', search, esResult.docs, esResult.pagination),
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
    if (subcategory) {
      filter.subcategory = {
        $in: subcategory.split(",").map((s) => s.trim()),
      };
    }
    if (condition) {
      filter.condition = { $in: condition.split(",").map((c) => c.trim()) };
    }
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    const { applyGeoFilter, buildSortOption, buildLocationRegex } = require("../utils/geoQuery");
    if (locationFilter) {
      filter.location = buildLocationRegex(locationFilter);
    }
    applyGeoFilter(filter, lat, lng, radius);

    const sortOption = buildSortOption(sort, !!(lat && lng), !!search);

    const skip = (safePage - 1) * safeLimit;

    let listings;
    let pagination;

    if (safePage > 1) {
      listings = await Sports.find(filter, LIST_PROJECTION)
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
        Sports.find(filter, LIST_PROJECTION)
          .sort(sortOption)
          .limit(safeLimit)
          .populate("seller", "name profileImage")
          .lean(),
        Sports.countDocuments(filter),
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
    res.setHeader(
      "Cache-Control",
      "public, max-age=30, stale-while-revalidate=300",
    );
    res.status(200).json({ success: true, listings, pagination });

    Promise.all([
      ListingCache.cacheListingList("sports", queryKey, listings, pagination),
      ListingCache.prefetchCategoryListings("sports", listings),
      search
        ? ListingCache.cacheSearchResults("sports", search, listings, pagination)
        : null,
    ]).catch((err) =>
      logger.error(
        "[Cache] Background sports cache write error:",
        err.message,
      ),
    );

    return;
  } catch (error) {
    logger.error("Get sports error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch sports" });
  }
};

exports.getSportsById = async (req, res) => {
  try {
    const param = req.params.id;
    const isObjectId = mongoose.Types.ObjectId.isValid(param);

    if (isObjectId) {
      const cached = await ListingCache.getCachedListing("sports", param);
      if (cached) {
        viewCounter.recordView("sports", param);
        normaliseImages(cached);
        res.setHeader("X-Cache", "HIT");
        res.setHeader("X-Cache-Source", "listing-cache");
        return res.status(200).json({ success: true, listing: cached });
      }
    }

    const listing = isObjectId
      ? await Sports.findById(param).populate(
          "seller",
          "name profileImage",
        )
      : await Sports.findOne({ slug: param, status: "active" }).populate(
          "seller",
          "name profileImage",
        );

    if (!listing || listing.status !== "active") {
      return res
        .status(404)
        .json({ success: false, message: "Sports listing not found" });
    }

    const listingId = listing._id.toString();
    viewCounter.recordView("sports", listingId);

    const listingObj = listing.toObject();
    normaliseImages(listingObj);

    res.setHeader("X-Cache", "MISS");
    res.status(200).json({ success: true, listing: listingObj });

    ListingCache.cacheListing("sports", listingObj).catch((err) =>
      logger.error(
        "[Cache] Background sports detail cache error:",
        err.message,
      ),
    );

    return;
  } catch (error) {
    logger.error("Get sports by id error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch sports listing" });
  }
};

exports.updateSports = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid listing ID format" });
    }

    const listing = await Sports.findById(req.params.id);
    if (!listing) {
      return res
        .status(404)
        .json({ success: false, message: "Sports listing not found" });
    }
    if (listing.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this listing",
      });
    }

    const incomingImages = Array.isArray(req.body.images)
      ? req.body.images
      : null;
    const removedImages = incomingImages
      ? (listing.images || []).filter((img) => !incomingImages.includes(img))
      : [];

    Object.assign(listing, { ...req.body, category: "Sports" });
    await listing.save();

    const updated = await Sports.findById(listing._id).populate(
      "seller",
      "name profileImage",
    );
    const listingObj = updated.toObject();
    normaliseImages(listingObj);

    try {
      await Promise.all([
        ListingCache.cacheListing("sports", listingObj),
        ListingCache.invalidateListCaches("sports"),
      ]);
    } catch (cacheErr) {
      logger.error(
        "[Cache] Sports update cache sync error:",
        cacheErr.message,
      );
    }

    publishListingUpdated({
      entity: "sports",
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
        entity: "sports",
        listingId: listing._id,
        urls: removedImages,
      }).catch(() => {});
    }

    return res.status(200).json({ success: true, listing: listingObj });
  } catch (error) {
    logger.error("Update sports error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update sports listing" });
  }
};

exports.deleteSports = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid listing ID format" });
    }

    const listing = await Sports.findById(req.params.id);
    if (!listing) {
      return res
        .status(404)
        .json({ success: false, message: "Sports listing not found" });
    }
    if (listing.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this listing",
      });
    }

    const listingObj = listing.toObject ? listing.toObject() : listing;
    await listing.deleteOne();

    try {
      await Promise.all([
        ListingCache.invalidateListCaches("sports"),
        ListingCache.invalidateListingCache("sports", req.params.id),
      ]);
    } catch (cacheErr) {
      logger.error(
        "[Cache] Sports delete cache sync error:",
        cacheErr.message,
      );
    }

    publishListingDeleted({
      entity: "sports",
      listingId: req.params.id,
      userId: req.user._id,
      listing: listingObj,
      images: listingObj.images || [],
      ip: req.ip,
      userAgent: req.get("user-agent"),
    }).catch(() => {});

    return res
      .status(200)
      .json({ success: true, message: "Sports listing deleted" });
  } catch (error) {
    logger.error("Delete sports error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete sports listing" });
  }
};

exports.getMySports = async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query, { limit: 20 });
    const { items, pagination } = await paginatedFind({
      model: Sports,
      filter: { seller: req.user._id },
      populate: [
        { path: "seller", select: "name profileImage" },
      ],
      page,
      limit,
    });

    items.forEach(normaliseImages);
    return res
      .status(200)
      .json({ success: true, listings: items, pagination });
  } catch (error) {
    logger.error("Get my sports error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch your sports listings",
    });
  }
};

exports.getSavedSports = async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query, { limit: 20 });

    const savedKey = `saved:sports:${req.user._id}:p${page}:l${limit}`;
    try {
      const cached = await redis.get(savedKey);
      if (cached) {
        const parsed = typeof cached === "string" ? JSON.parse(cached) : cached;
        if (parsed?.listings) parsed.listings.forEach(normaliseImages);
        res.setHeader("X-Cache", "HIT");
        return res.status(200).json(parsed);
      }
    } catch (cacheErr) {
      logger.warn("Saved sports cache read failed", {
        error: cacheErr.message,
      });
    }

    const { items, pagination } = await paginatedFind({
      model: Sports,
      filter: { savedBy: req.user._id, status: "active" },
      populate: [
        { path: "seller", select: "name profileImage" },
      ],
      page,
      limit,
    });

    items.forEach(normaliseImages);

    const payload = { success: true, listings: items, pagination };
    try {
      await redis.set(savedKey, JSON.stringify(payload), { ex: 300 });
    } catch (cacheErr) {
      logger.warn("Saved sports cache write failed", {
        error: cacheErr.message,
      });
    }

    return res.status(200).json(payload);
  } catch (error) {
    logger.error("Get saved sports error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch saved sports" });
  }
};

exports.uploadImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No images provided" });
    }

    const imageUrls = [];
    for (const file of req.files) {
      const result = await S3Service.uploadListingImage(
        file.buffer,
        req.user._id.toString(),
        file.mimetype,
        "sports",
      );
      imageUrls.push(result.imageUrl);
    }

    try {
      await ListingCache.cacheUploadedImages(
        "sports",
        req.user._id.toString(),
        imageUrls,
      );
    } catch (cacheErr) {
      logger.error(
        "[Cache] Error caching uploaded sports images:",
        cacheErr.message,
      );
    }

    return res.status(200).json({ success: true, imageUrls });
  } catch (error) {
    logger.error("Sports image upload error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to upload images" });
  }
};

exports.toggleSave = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid listing ID format" });
    }

    const userId = req.user._id;
    const listing = await Sports.findById(req.params.id).select('savedBy status').lean();
    if (!listing || listing.status !== "active") {
      return res
        .status(404)
        .json({ success: false, message: "Sports listing not found" });
    }

    const alreadySaved = listing.savedBy?.some(
      (savedId) => savedId.toString() === userId.toString(),
    );

    if (alreadySaved) {
      await Sports.updateOne({ _id: req.params.id }, { $pull: { savedBy: userId } });
    } else {
      await Sports.updateOne({ _id: req.params.id }, { $addToSet: { savedBy: userId } });
    }

    try {
      await Promise.all([
        ListingCache.invalidateListingCache("sports", req.params.id),
        redis.del(`saved:sports:${userId}:p1:l20`),
      ]);
    } catch (cacheErr) {
      logger.warn("Sports save cache invalidation failed", {
        error: cacheErr.message,
      });
    }

    return res.status(200).json({ success: true, saved: !alreadySaved });
  } catch (error) {
    logger.error("Toggle save sports error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update saved listing" });
  }
};
