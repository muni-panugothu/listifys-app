const User = require("../models/user.model");
const Notification = require("../models/notification.model");
const Conversation = require("../models/conversation.model");
const Message = require("../models/message.model");
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
const ServiceListing = require("../models/servicelisting.model");
const ServiceBooking = require("../models/servicebooking.model");
const ServiceRequest = require("../models/servicerequest.model");
const ServiceReview = require("../models/servicereview.model");
const ServiceProvider = require("../models/serviceprovider.model");
const Sports = require("../models/sports.model");
const Collectible = require("../models/collectible.model");
const Pet = require("../models/pet.model");
const Book = require("../models/book.model");
const Beauty = require("../models/beauty.model");
const Other = require("../models/other.model");
const s3Service = require("../services/s3.service");
const RedisService = require("../services/redis.service");
const { logger } = require("../utils/logger");
const argon2 = require("argon2");
const redis = require("../config/redis");
const { invalidateAuthCache } = require("../middleware/auth.middleware");

const invalidateSettingsCaches = async (userId) => {
  try {
    const id = String(userId);
    invalidateAuthCache(id);
    await Promise.all([
      redis.del(`profile:${id}`),
      redis.del(`settings:${id}`),
      redis.del(`activity:${id}`),
    ]);
  } catch (_) {
    // Cache invalidation is best-effort.
  }
};

// ==================== UPDATE NOTIFICATION PREFERENCES ====================
exports.updatePreferences = async (req, res) => {
  try {
    const {
      emailNotifications,
      pushNotifications,
      marketingEmails,
      twoFactorAuth,
      theme,
    } = req.body;
    const update = {};

    if (typeof emailNotifications === "boolean") {
      update["preferences.emailNotifications"] = emailNotifications;
    }
    if (typeof pushNotifications === "boolean") {
      update["preferences.pushNotifications"] = pushNotifications;
    }
    if (typeof marketingEmails === "boolean") {
      update["preferences.marketingEmails"] = marketingEmails;
    }
    if (typeof twoFactorAuth === "boolean") {
      update["preferences.twoFactorAuth"] = twoFactorAuth;
    }
    if (typeof theme === "string" && ["light", "dark", "auto"].includes(theme)) {
      update["preferences.theme"] = theme;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ success: false, message: "No valid preferences provided" });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: update },
      { new: true, runValidators: true }
    ).select("preferences");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    await invalidateSettingsCaches(req.user.id);

    res.status(200).json({
      success: true,
      message: "Preferences updated",
      preferences: {
        emailNotifications: user.preferences.emailNotifications,
        pushNotifications: user.preferences.pushNotifications,
        marketingEmails: user.preferences.marketingEmails,
        twoFactorAuth: user.preferences.twoFactorAuth,
        theme: user.preferences.theme,
      },
    });
  } catch (error) {
    logger.error("Update preferences error:", error);
    res.status(500).json({ success: false, message: "Failed to update preferences" });
  }
};

// ==================== GET NOTIFICATION PREFERENCES ====================
exports.getPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("preferences").lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      preferences: {
        emailNotifications: user.preferences?.emailNotifications ?? true,
        pushNotifications: user.preferences?.pushNotifications ?? true,
        marketingEmails: user.preferences?.marketingEmails ?? false,
        twoFactorAuth: user.preferences?.twoFactorAuth ?? false,
        theme: user.preferences?.theme ?? 'auto',
      },
    });
  } catch (error) {
    logger.error("Get preferences error:", error);
    res.status(500).json({ success: false, message: "Failed to get preferences" });
  }
};

// ==================== DELETE ACCOUNT ====================
exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { password, confirmation } = req.body;

    // --- Validation ---
    if (confirmation !== "DELETE MY ACCOUNT") {
      return res.status(400).json({
        success: false,
        message: 'Please type "DELETE MY ACCOUNT" to confirm',
      });
    }

    const user = await User.findById(userId).select("+password preferences provider profileImageKey");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Password verification for email-based accounts
    if (user.provider !== "google" && user.password) {
      if (!password) {
        return res.status(400).json({
          success: false,
          message: "Password is required to delete your account",
        });
      }
      const isMatch = await argon2.verify(user.password, password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: "Incorrect password",
        });
      }
    }

    logger.info(`[AccountDeletion] Starting deletion for user ${userId}`);

    // --- 0. Close all active chat threads (read-only for other party) ---
    try {
      const ProductThread = require("../models/product-thread.model");
      const Message = require("../models/message.model");
      const Conversation = require("../models/conversation.model");
      const { getIO } = require("../config/socket");

      const activeThreads = await ProductThread.find({
        $or: [{ seller: userId }, { buyer: userId }],
        status: "active",
      }).lean();

      if (activeThreads.length > 0) {
        const now = new Date();
        await ProductThread.updateMany(
          { _id: { $in: activeThreads.map((t) => t._id) } },
          {
            $set: {
              status: "closed",
              closedReason: "deleted",
              closedAt: now,
            },
          },
        );

        const convCounts = {};
        for (const t of activeThreads) {
          const cid = String(t.conversation);
          convCounts[cid] = (convCounts[cid] || 0) + 1;
        }
        await Promise.all(
          Object.entries(convCounts).map(([cid, count]) =>
            Conversation.updateOne(
              { _id: cid },
              { $inc: { activeThreadCount: -count } },
            ),
          ),
        );

        const systemMsgs = await Message.insertMany(
          activeThreads.map((t) => ({
            conversation: t.conversation,
            productThread: t._id,
            sender: userId,
            content: "This account was deleted. Conversation is read-only.",
            messageType: "system",
            readBy: [userId],
            status: "sent",
          })),
        );

        await Promise.all(
          activeThreads.map((t, i) =>
            Conversation.updateOne(
              { _id: t.conversation },
              { $set: { lastMessage: systemMsgs[i]._id } },
            ),
          ),
        );

        try {
          const io = getIO();
          for (const t of activeThreads) {
            io.to(`conversation:${t.conversation}`).emit("thread:closed", {
              threadId: String(t._id),
              status: "closed",
              closedReason: "deleted",
              closedAt: now,
            });
          }
        } catch {
          // socket optional
        }
      }
    } catch (threadErr) {
      logger.error("[AccountDeletion] thread close error:", threadErr);
    }

    // --- 1. Collect all listings with images for S3 cleanup ---
    const listingModels = [
      { model: Electronics, name: "electronics" },
      { model: Mobile, name: "mobiles" },
      { model: Vehicle, name: "vehicles" },
      { model: Job, name: "jobs" },
      { model: Furniture, name: "furniture" },
      { model: Toy, name: "toys" },
      { model: Fashion, name: "fashion" },
      { model: TakeCare, name: "takecare" },
      { model: ForSale, name: "forsale" },
      { model: Event, name: "events" },
      { model: Property, name: "properties" },
      { model: Sports, name: "sports" },
      { model: Collectible, name: "collectibles" },
      { model: Pet, name: "pets" },
      { model: Book, name: "books" },
      { model: Beauty, name: "beauty" },
      { model: Other, name: "others" },
      { model: ServiceListing, name: "serviceListings", field: "userId" },
    ];

    // Gather all image URLs from user's listings
    const allImageUrls = [];
    const deletionResults = {};

    await Promise.all(
      listingModels.map(async ({ model, name, field }) => {
        try {
          const query = { [field || "seller"]: userId };
          const listings = await model.find(query).select("images").lean();
          for (const listing of listings) {
            if (listing.images?.length) {
              for (const img of listing.images) {
                if (typeof img === 'string') {
                  allImageUrls.push(img);
                } else if (img && typeof img === 'object' && img.url) {
                  allImageUrls.push(img.url);
                }
              }
            }
          }
          const result = await model.deleteMany(query);
          deletionResults[name] = result.deletedCount;
        } catch (err) {
          logger.error(`[AccountDeletion] Failed to delete ${name}:`, err);
          deletionResults[name] = 0;
        }
      })
    );

    // --- 2. Delete profile image from S3 ---
    if (user.profileImageKey) {
      allImageUrls.push(user.profileImageKey);
    }

    // --- 3. Delete all S3 images in background (non-blocking) ---
    if (allImageUrls.length > 0) {
      s3Service.deleteImagesByUrls(allImageUrls).then((result) => {
        logger.info(`[AccountDeletion] S3 cleanup: ${result.deleted}/${result.requested} images deleted`);
      }).catch((err) => {
        logger.error("[AccountDeletion] S3 cleanup error:", err);
      });
    }

    // --- 4. Delete service-related data ---
    await Promise.all([
      ServiceBooking.deleteMany({ userId }).catch(() => {}),
      ServiceRequest.deleteMany({ userId }).catch(() => {}),
      ServiceReview.deleteMany({ userId }).catch(() => {}),
      ServiceProvider.deleteMany({ userId }).catch(() => {}),
    ]);

    // --- 5. Delete notifications ---
    await Notification.deleteMany({
      $or: [{ recipient: userId }, { sender: userId }],
    }).catch(() => {});

    // --- 6. Preserve chat conversations (only remove user from participant list) ---
    await Conversation.updateMany(
      { participants: userId },
      { $pull: { participants: userId } }
    ).catch(() => {});

    // --- 7. Remove user from followers/following lists ---
    await User.updateMany(
      { followers: userId },
      { $pull: { followers: userId } }
    ).catch(() => {});
    await User.updateMany(
      { following: userId },
      { $pull: { following: userId } }
    ).catch(() => {});

    // --- 8. Remove saved references in other users ---
    // (savedListings references are user-scoped, no cross-user cleanup needed)

    // --- 9. Invalidate Redis cache ---
    try {
      const cacheKeys = [
        `user:${userId}`,
        `profile:${userId}`,
        `devices:${userId}`,
        `sessions:${userId}`,
      ];
      await Promise.all(cacheKeys.map((key) => RedisService.del(key).catch(() => {})));

      // Invalidate listing caches for all categories
      const categoryPrefixes = [
        "electronics", "mobiles", "vehicles", "jobs", "furniture",
        "toys", "fashion", "takecare", "forsale", "events",
        "properties", "serviceListings", "sports", "collectibles",
        "pets", "books", "beauty", "others",
      ];
      for (const prefix of categoryPrefixes) {
        await RedisService.del(`${prefix}:seller:${userId}`).catch(() => {});
      }
    } catch (err) {
      logger.error("[AccountDeletion] Redis cleanup error:", err);
    }

    // --- 10. Clear auth cookies ---
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    };
    res.clearCookie("accessToken", cookieOptions);
    res.clearCookie("refreshToken", cookieOptions);
    res.clearCookie("__fgp", cookieOptions);

    // --- 10. Force-disconnect all active sessions via socket ---
    try {
      const { forceLogoutUser } = require("../config/socket");
      forceLogoutUser(userId.toString());
    } catch {
      // optional
    }

    // --- 11. Delete the user document ---
    await User.findByIdAndDelete(userId);

    logger.info(`[AccountDeletion] User ${userId} fully deleted`, { deletionResults });

    res.status(200).json({
      success: true,
      message: "Account and all associated data have been permanently deleted",
      summary: deletionResults,
    });
  } catch (error) {
    logger.error("[AccountDeletion] Fatal error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete account. Please try again or contact support.",
    });
  }
};
