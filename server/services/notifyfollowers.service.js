const User = require("../models/user.model.js");
const { createNotification } = require("../controllers/notification.controller.js");
const { getIO } = require("../config/socket");
const { decrypt } = require("./encryption.service.js");
const { logger } = require("../utils/logger");

/**
 * Notify all followers of a seller when they post a new listing.
 * Creates a DB notification for each follower and pushes a real-time
 * socket event so the UI updates instantly (like Amazon/Flipkart).
 *
 * @param {string} sellerId   - The ObjectId of the user who posted
 * @param {object} listing    - The newly created listing object
 * @param {string} listingType - "forsale" | "electronics" | "vehicles"
 */
async function notifyFollowersOfNewListing(sellerId, listing, listingType) {
  try {
    const seller = await User.findById(sellerId).select("followers name email");
    if (!seller || !seller.followers || seller.followers.length === 0) return;

    const sellerName = seller.firstName
      ? `${seller.firstName} ${seller.lastName || ""}`.trim()
      : seller.email?.split("@")[0] || "Someone";

    const message = `${sellerName} posted a new ${listingType} listing: "${listing.title}"`;
    const io = getIO();

    const notificationPromises = seller.followers.map(async (followerId) => {
      const notification = await createNotification({
        recipient: followerId,
        sender: sellerId,
        type: "new_listing",
        message,
        metadata: {
          listingId: listing._id,
          listingType,
          listingTitle: listing.title,
          listingImage: listing.images?.[0] || null,
          listingPrice: listing.price,
        },
      });

      if (notification && io) {
        // Populate sender info for the real-time payload
        const populated = await notification.populate(
          "sender",
          "name profileImage googleProfileImage avatar provider"
        );
        const s = populated.sender;
        const profileImg = s.profileImage || s.googleProfileImage || s.avatar || null;
        io.to(`user:${followerId}`).emit("notification:new", {
          _id: populated._id,
          type: populated.type,
          message: decrypt(populated.message),
          read: false,
          createdAt: populated.createdAt,
          metadata: populated.metadata,
          sender: {
            _id: s._id,
            name: s.firstName ? `${s.firstName} ${s.lastName || ""}`.trim() : "User",
            profileImage: profileImg,
            profileImageUrl: profileImg,
          },
        });
      }
    });

    await Promise.allSettled(notificationPromises);
    logger.info(`📢 Notified ${seller.followers.length} followers of new ${listingType} listing`, {
      sellerId, listingId: listing._id,
    });
  } catch (err) {
    logger.error("[notifyFollowers] Error:", err.message);
  }
}

module.exports = { notifyFollowersOfNewListing };
