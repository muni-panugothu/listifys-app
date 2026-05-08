const User = require("../models/user.model");
const Electronics = require("../models/electronics.model");
const Mobile = require("../models/mobile.model");
const Vehicle = require("../models/vehicle.model");
const Job = require("../models/job.model");
const Furniture = require("../models/furniture.model");
const Toy = require("../models/toy.model");
const Fashion = require("../models/fashion.model");
const TakeCare = require("../models/takecare.model");
const ForSale = require("../models/forsale.model");
const Event = require("../models/event.model");
const Property = require("../models/property.model");
const Sports = require("../models/sports.model");
const Collectible = require("../models/collectible.model");
const Pet = require("../models/pet.model");
const Book = require("../models/book.model");
const Beauty = require("../models/beauty.model");
const Other = require("../models/other.model");
const ServiceListing = require("../models/servicelisting.model");
const Conversation = require("../models/conversation.model");
const Message = require("../models/message.model");
const Notification = require("../models/notification.model");
const { logger } = require("../utils/logger");
const { decrypt } = require("../services/encryption.service");
const s3Service = require("../services/s3.service");
const { sendAccountActionEmail } = require("../services/email.service");
const { escapeRegex } = require("../utils/geoQuery");
const SearchService = require("../services/search.service");

// ── Helper: normalize image URLs after .lean() (toJSON transforms are skipped) ──
const normalizeImages = (doc) => {
  if (!doc) return doc;
  if (Array.isArray(doc.images)) {
    doc.images = doc.images.map((img) => {
      // ServiceListing stores images as { url, publicId, isPrimary }
      if (img && typeof img === "object" && img.url) return s3Service.toProxyUrl(img.url);
      if (typeof img === "string") return s3Service.toProxyUrl(img);
      return img;
    }).filter(Boolean);
  }
  // Also handle profile images on user objects
  if (doc.profileImage) doc.profileImage = s3Service.toProxyUrl(doc.profileImage);
  if (doc.avatar) doc.avatar = s3Service.toProxyUrl(doc.avatar);
  return doc;
};

// ── Dashboard overview stats ─────────────────────────────────────
exports.getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      bannedUsers,
      newUsersToday,
      totalConversations,
      totalMessages,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: "active" }),
      User.countDocuments({ status: { $in: ["suspended", "banned"] } }),
      User.countDocuments({
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      }),
      Conversation.countDocuments(),
      Message.countDocuments(),
    ]);

    // Listing counts per category
    const listingModels = [
      { name: "electronics", model: Electronics },
      { name: "mobiles", model: Mobile },
      { name: "vehicles", model: Vehicle },
      { name: "jobs", model: Job },
      { name: "furniture", model: Furniture },
      { name: "toys", model: Toy },
      { name: "fashion", model: Fashion },
      { name: "sports", model: Sports },
      { name: "collectibles", model: Collectible },
      { name: "pets", model: Pet },
      { name: "books", model: Book },
      { name: "beauty", model: Beauty },
      { name: "others", model: Other },
      { name: "takecare", model: TakeCare },
      { name: "forsale", model: ForSale },
      { name: "events", model: Event },
      { name: "properties", model: Property },
      { name: "services", model: ServiceListing },
    ];

    const listingCounts = {};
    let totalListings = 0;
    await Promise.all(
      listingModels.map(async ({ name, model }) => {
        const count = await model.countDocuments();
        listingCounts[name] = count;
        totalListings += count;
      })
    );

    // User growth (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const userGrowth = await User.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        users: { total: totalUsers, active: activeUsers, banned: bannedUsers, newToday: newUsersToday },
        listings: { total: totalListings, byCategory: listingCounts },
        chat: { conversations: totalConversations, messages: totalMessages },
        userGrowth,
      },
    });
  } catch (error) {
    logger.error("[Admin] getDashboardStats error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch stats" });
  }
};

// ── List all users (paginated, searchable) ───────────────────────
exports.getUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const search = req.query.search || "";
    const status = req.query.status || "";
    const role = req.query.role || "";
    // Whitelist allowed sort fields to prevent unindexed-sort abuse
    const ALLOWED_SORT_FIELDS = ["createdAt", "name", "email", "lastLogin", "status", "role"];
    const sortBy = ALLOWED_SORT_FIELDS.includes(req.query.sortBy) ? req.query.sortBy : "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: escapeRegex(search), $options: "i" } },
        { email: { $regex: escapeRegex(search), $options: "i" } },
      ];
    }
    if (status) filter.status = status;
    if (role) filter.role = role;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("name email role status provider isVerified createdAt lastLogin loginHistory profileImage avatar devices")
        .sort({ [sortBy]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    // Attach listing count per user
    const userIds = users.map((u) => u._id);
    const listingModels = [
      { model: Electronics, field: "seller" },
      { model: Mobile, field: "seller" },
      { model: Vehicle, field: "seller" },
      { model: Job, field: "seller" },
      { model: Furniture, field: "seller" },
      { model: Toy, field: "seller" },
      { model: Fashion, field: "seller" },
      { model: Sports, field: "seller" },
      { model: Collectible, field: "seller" },
      { model: Pet, field: "seller" },
      { model: Book, field: "seller" },
      { model: Beauty, field: "seller" },
      { model: Other, field: "seller" },
      { model: ForSale, field: "seller" },
      { model: TakeCare, field: "seller" },
      { model: Event, field: "seller" },
      { model: Property, field: "seller" },
      { model: ServiceListing, field: "userId" },
    ];

    const listingCountMap = {};
    await Promise.all(
      listingModels.map(async ({ model, field }) => {
        const counts = await model.aggregate([
          { $match: { [field]: { $in: userIds } } },
          { $group: { _id: `$${field}`, count: { $sum: 1 } } },
        ]);
        counts.forEach(({ _id, count }) => {
          const key = _id.toString();
          listingCountMap[key] = (listingCountMap[key] || 0) + count;
        });
      })
    );

    const enrichedUsers = users.map((u) => {
      // Extract counts before normalizing, then strip PII arrays
      const deviceCount = u.devices?.length || 0;
      const lastLoginAt = u.lastLogin || u.loginHistory?.[u.loginHistory.length - 1]?.timestamp || null;
      const { devices, loginHistory, ...safeUser } = normalizeImages(u);
      return {
        ...safeUser,
        listingCount: listingCountMap[u._id.toString()] || 0,
        deviceCount,
        lastLoginAt,
      };
    });

    res.json({
      success: true,
      data: { users: enrichedUsers, total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error("[Admin] getUsers error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch users" });
  }
};

// ── Get single user detail ───────────────────────────────────────
exports.getUserDetail = async (req, res) => {
  try {
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }
    const user = await User.findById(req.params.id)
      .select("-password -passwordHistory -securityLogs -emailVerificationToken -emailVerificationExpires -passwordResetToken -passwordResetExpires -devices -loginHistory -twoFactorSecret -phone")
      .lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    res.json({ success: true, data: user });
  } catch (error) {
    logger.error("[Admin] getUserDetail error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch user" });
  }
};

// ── Update user status/role ──────────────────────────────────────
exports.updateUser = async (req, res) => {
  try {
    const { status, role } = req.body;
    const updates = {};
    if (status && ["active", "inactive", "suspended", "banned"].includes(status)) updates.status = status;
    if (role && ["user", "admin", "moderator"].includes(role)) updates.role = role;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: "No valid updates provided" });
    }

    // Prevent self-demotion
    if (req.params.id === req.user.id && updates.role && updates.role !== "admin") {
      return res.status(400).json({ success: false, message: "Cannot change your own role" });
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true })
      .select("name email role status");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // Send email notification on status change (ban/suspend/activate)
    if (updates.status && ["banned", "suspended", "active"].includes(updates.status)) {
      sendAccountActionEmail(user.email, user.name, updates.status).catch((err) => {
        logger.error("[Admin] Failed to send account action email", { error: err.message, userId: req.params.id });
      });
    }

    logger.info(`[Admin] User ${req.params.id} updated by admin ${req.user.id}`, updates);
    res.json({ success: true, data: user });
  } catch (error) {
    logger.error("[Admin] updateUser error:", error);
    res.status(500).json({ success: false, message: "Failed to update user" });
  }
};

// ── Get user's listings ──────────────────────────────────────────
exports.getUserListings = async (req, res) => {
  try {
    const userId = req.params.id;
    const allListings = [];

    const models = [
      { model: Electronics, type: "electronics", field: "seller" },
      { model: Mobile, type: "mobiles", field: "seller" },
      { model: Vehicle, type: "vehicles", field: "seller" },
      { model: Job, type: "jobs", field: "seller" },
      { model: Furniture, type: "furniture", field: "seller" },
      { model: Toy, type: "toys", field: "seller" },
      { model: Fashion, type: "fashion", field: "seller" },
      { model: Sports, type: "sports", field: "seller" },
      { model: Collectible, type: "collectibles", field: "seller" },
      { model: Pet, type: "pets", field: "seller" },
      { model: Book, type: "books", field: "seller" },
      { model: Beauty, type: "beauty", field: "seller" },
      { model: Other, type: "others", field: "seller" },
      { model: ForSale, type: "forsale", field: "seller" },
      { model: TakeCare, type: "takecare", field: "seller" },
      { model: Event, type: "events", field: "seller" },
      { model: Property, type: "properties", field: "seller" },
      { model: ServiceListing, type: "services", field: "userId" },
    ];

    await Promise.all(
      models.map(async ({ model, type, field }) => {
        const listings = await model.find({ [field]: userId })
          .select("title price images location createdAt category subcategory slug")
          .sort({ createdAt: -1 })
          .limit(50)
          .lean();
        listings.forEach((l) => allListings.push({ ...normalizeImages(l), _listingType: type }));
      })
    );

    allListings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, data: allListings });
  } catch (error) {
    logger.error("[Admin] getUserListings error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch listings" });
  }
};

// ── Get conversations list (admin can view all) ──────────────────
exports.getConversations = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const search = req.query.search || "";

    let filter = {};
    if (search) {
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: escapeRegex(search), $options: "i" } },
          { email: { $regex: escapeRegex(search), $options: "i" } },
        ],
      }).select("_id").lean();
      const userIds = matchingUsers.map((u) => u._id);
      if (userIds.length > 0) {
        filter.participants = { $in: userIds };
      } else {
        return res.json({ success: true, data: { conversations: [], total: 0, page, pages: 0 } });
      }
    }

    const [conversations, total] = await Promise.all([
      Conversation.find(filter)
        .populate("participants", "name email profileImage avatar")
        .populate("lastMessage", "content createdAt sender")
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Conversation.countDocuments(filter),
    ]);

    // Decrypt lastMessage content for admin display
    for (const conv of conversations) {
      if (conv.lastMessage?.content) {
        try { conv.lastMessage.content = decrypt(conv.lastMessage.content); } catch { /* pre-encryption or corrupt message */ }
      }
    }

    res.json({
      success: true,
      data: { conversations, total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error("[Admin] getConversations error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch conversations" });
  }
};

// ── Get messages for a conversation ──────────────────────────────
exports.getConversationMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));

    const [messages, total] = await Promise.all([
      Message.find({ conversation: conversationId })
        .populate("sender", "name email profileImage avatar")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Message.countDocuments({ conversation: conversationId }),
    ]);

    // Decrypt message content for admin display
    const decrypted = messages.reverse().map((m) => ({
      ...m,
      content: m.content ? (() => { try { return decrypt(m.content); } catch { return m.content; } })() : m.content,
    }));

    res.json({
      success: true,
      data: { messages: decrypted, total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error("[Admin] getConversationMessages error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch messages" });
  }
};

// ── Get all listings across categories (paginated) ───────────────
exports.getAllListings = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const search = req.query.search || "";
    const category = req.query.category || "";

    const modelMap = {
      electronics: Electronics, mobiles: Mobile, vehicles: Vehicle, jobs: Job,
      furniture: Furniture, toys: Toy, fashion: Fashion, sports: Sports,
      collectibles: Collectible, pets: Pet, books: Book, beauty: Beauty,
      others: Other, forsale: ForSale, events: Event, properties: Property,
      takecare: TakeCare, services: ServiceListing,
    };

    // If category specified, query only that model
    const categories = category && modelMap[category]
      ? { [category]: modelMap[category] }
      : modelMap;

    // ── Elasticsearch-first search (MongoDB regex fallback below) ──
    if (search && SearchService.isAvailable()) {
      try {
        const esResult = await SearchService.search({
          query: search,
          entity: category || 'all',
          sort: 'relevance',
          page,
          limit,
        });

        if (esResult && esResult.listings.length > 0) {
          const sellerField = { services: "userId" };

          // Group ES hits by entity for MongoDB hydration
          const byEntity = {};
          for (const hit of esResult.listings) {
            const entity = hit._entity;
            (byEntity[entity] ||= []).push(hit._id);
          }

          const fullDocs = [];
          await Promise.all(
            Object.entries(byEntity).map(async ([key, ids]) => {
              const Model = modelMap[key];
              if (!Model) return;
              const ownerField = sellerField[key] || "seller";
              const docs = await Model.find({ _id: { $in: ids } })
                .populate(ownerField, "name email")
                .select(`title images price createdAt slug ${ownerField}`)
                .lean();
              for (const d of docs) {
                normalizeImages(d);
                const owner = d[ownerField] || null;
                fullDocs.push({ ...d, _listingType: key, _owner: owner });
              }
            })
          );

          // Preserve ES relevance order
          const orderMap = new Map(esResult.listings.map((l, i) => [l._id, i]));
          fullDocs.sort(
            (a, b) =>
              (orderMap.get(a._id.toString()) ?? 999) -
              (orderMap.get(b._id.toString()) ?? 999)
          );

          // Category counts via ES entity grouping (approximate from current results)
          const categoryCounts = {};
          for (const hit of esResult.listings) {
            categoryCounts[hit._entity] = (categoryCounts[hit._entity] || 0) + 1;
          }

          return res.json({
            success: true,
            data: {
              listings: fullDocs,
              total: esResult.pagination.total,
              page,
              pages: esResult.pagination.pages,
              categoryCounts,
            },
          });
        }
      } catch (esErr) {
        logger.error("[Admin] ES search fallback:", esErr.message);
      }
    }

    const filter = search
      ? { title: { $regex: escapeRegex(search), $options: "i" } }
      : {};

    // Get counts per category first
    const countPromises = Object.entries(categories).map(async ([key, Model]) => {
      const count = await Model.countDocuments(filter);
      return { key, count };
    });
    const counts = await Promise.all(countPromises);
    const totalAll = counts.reduce((sum, c) => sum + c.count, 0);

    // Correct global pagination: fetch only IDs+dates from all collections,
    // sort globally, then hydrate only the current page's documents.
    // Optimization: limit stubs per category to (globalSkip + limit) to avoid
    // loading the entire DB into memory for large datasets.
    const sellerField = { services: "userId" };
    const globalSkip = (page - 1) * limit;
    const stubLimit = globalSkip + limit; // We only need enough to fill this page

    // Step 1: Get lightweight stubs (only _id, createdAt) from each category
    // Capped at stubLimit per collection — sufficient for correct global sort
    const stubPromises = Object.entries(categories).map(async ([key, Model]) => {
      const stubs = await Model.find(filter)
        .select("_id createdAt")
        .sort({ createdAt: -1 })
        .limit(stubLimit)
        .lean();
      return stubs.map((s) => ({ _id: s._id, createdAt: s.createdAt, _listingType: key }));
    });
    const allStubs = (await Promise.all(stubPromises)).flat();

    // Step 2: Global sort by createdAt desc, then slice for the page
    allStubs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const pageStubs = allStubs.slice(globalSkip, globalSkip + limit);

    // Step 3: Group page stubs by category and fetch full docs
    const grouped = {};
    for (const stub of pageStubs) {
      (grouped[stub._listingType] ||= []).push(stub._id);
    }

    const fullDocs = [];
    await Promise.all(
      Object.entries(grouped).map(async ([key, ids]) => {
        const Model = modelMap[key];
        const ownerField = sellerField[key] || "seller";
        const docs = await Model.find({ _id: { $in: ids } })
          .populate(ownerField, "name email")
          .select(`title images price createdAt slug ${ownerField}`)
          .lean();
        for (const d of docs) {
          normalizeImages(d);
          const owner = d[ownerField] || null;
          fullDocs.push({ ...d, _listingType: key, _owner: owner });
        }
      })
    );

    // Step 4: Re-sort the full page docs in the correct global order
    fullDocs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const categoryCounts = {};
    counts.forEach((c) => { if (c.count > 0) categoryCounts[c.key] = c.count; });

    res.json({
      success: true,
      data: {
        listings: fullDocs,
        total: totalAll,
        page,
        pages: Math.ceil(totalAll / limit),
        categoryCounts,
      },
    });
  } catch (error) {
    logger.error("[Admin] getAllListings error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch listings" });
  }
};

// ── Delete a user's listing (admin moderation) ───────────────────
exports.deleteListing = async (req, res) => {
  try {
    const { listingType, listingId } = req.params;
    const modelMap = {
      electronics: Electronics, mobiles: Mobile, vehicles: Vehicle, jobs: Job,
      furniture: Furniture, toys: Toy, fashion: Fashion, sports: Sports,
      collectibles: Collectible, pets: Pet, books: Book, beauty: Beauty,
      others: Other, forsale: ForSale, events: Event, properties: Property,
      takecare: TakeCare, services: ServiceListing,
    };
    const Model = modelMap[listingType];
    if (!Model) return res.status(400).json({ success: false, message: "Invalid listing type" });

    const listing = await Model.findByIdAndDelete(listingId);
    if (!listing) return res.status(404).json({ success: false, message: "Listing not found" });

    // S3 cleanup for orphaned images (fire-and-forget)
    const imageUrls = (listing.images || [])
      .map((img) => (typeof img === 'string' ? img : img?.url))
      .filter(Boolean);
    if (imageUrls.length > 0) {
      s3Service.deleteImagesByUrls(imageUrls).catch((err) =>
        logger.error('[Admin] S3 cleanup failed for deleted listing', { listingId, error: err.message })
      );
    }

    logger.info(`[Admin] Listing ${listingId} (${listingType}) deleted by admin ${req.user.id}`);
    res.json({ success: true, message: "Listing deleted" });
  } catch (error) {
    logger.error("[Admin] deleteListing error:", error);
    res.status(500).json({ success: false, message: "Failed to delete listing" });
  }
};

// ── Recent activity (new users + new listings today) ─────────────
exports.getRecentActivity = async (req, res) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // last 7 days

    const recentUsers = await User.find({ createdAt: { $gte: since } })
      .select("name email createdAt provider profileImage avatar")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    recentUsers.forEach(normalizeImages);

    // Query recent listings from ALL categories
    const recentListings = [];
    const sampleModels = [
      { model: Electronics, type: "electronics" },
      { model: Vehicle, type: "vehicles" },
      { model: Mobile, type: "mobiles" },
      { model: Job, type: "jobs" },
      { model: Furniture, type: "furniture" },
      { model: Toy, type: "toys" },
      { model: Fashion, type: "fashion" },
      { model: Sports, type: "sports" },
      { model: Collectible, type: "collectibles" },
      { model: Pet, type: "pets" },
      { model: Book, type: "books" },
      { model: Beauty, type: "beauty" },
      { model: Other, type: "others" },
      { model: ForSale, type: "forsale" },
      { model: Event, type: "events" },
      { model: Property, type: "properties" },
      { model: TakeCare, type: "takecare" },
      { model: ServiceListing, type: "services" },
    ];
    await Promise.all(
      sampleModels.map(async ({ model, type }) => {
        try {
          const items = await model.find({ createdAt: { $gte: since } })
            .select("title price images createdAt slug")
            .sort({ createdAt: -1 })
            .limit(3)
            .lean();
          items.forEach((i) => recentListings.push({ ...normalizeImages(i), _type: type }));
        } catch {
          // Skip models that fail (e.g. schema mismatch)
        }
      })
    );
    recentListings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      data: { recentUsers, recentListings: recentListings.slice(0, 15) },
    });
  } catch (error) {
    logger.error("[Admin] getRecentActivity error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch activity" });
  }
};
