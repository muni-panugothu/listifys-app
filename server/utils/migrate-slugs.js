const { generateSlug } = require("./slugify");
const { logger } = require("./logger");

/**
 * Migrate a single Mongoose model – populate the `slug` field for all
 * documents that don't have one yet.  Handles duplicate titles by
 * appending a numeric counter.
 */
async function migrateModelSlugs(Model, modelName) {
  try {
    const docs = await Model.find({
      $or: [{ slug: { $exists: false } }, { slug: null }, { slug: "" }],
    })
      .select("_id title name")
      .lean();

    if (docs.length === 0) return;

    logger.error(
      `[Slug-Migration] Generating slugs for ${docs.length} ${modelName} record(s)…`,
    );

    // Track slugs already assigned during this run to avoid duplicates
    const usedSlugs = new Set();

    // Pre-load existing slugs from the collection so we don't collide
    const existing = await Model.find({ slug: { $exists: true, $ne: null } })
      .select("slug")
      .lean();
    for (const e of existing) {
      if (e.slug) usedSlugs.add(e.slug);
    }

    const bulkOps = [];
    for (const doc of docs) {
      const text = doc.title || doc.name || "";
      let baseSlug = generateSlug(text);
      if (!baseSlug) baseSlug = doc._id.toString();

      let slug = baseSlug;
      let counter = 1;
      while (usedSlugs.has(slug)) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      usedSlugs.add(slug);

      bulkOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { slug } },
        },
      });
    }

    if (bulkOps.length > 0) {
      await Model.bulkWrite(bulkOps, { ordered: false });
    }

    logger.error(
      `[Slug-Migration] ✓ ${modelName}: ${bulkOps.length} slug(s) created.`,
    );
  } catch (err) {
    logger.error(`[Slug-Migration] ✗ ${modelName} error:`, err.message);
  }
}

/**
 * Run slug migration for all listing models.
 * Safe to call on every startup – it's a no-op when all docs already have slugs.
 */
async function migrateAllSlugs() {
  const models = [
    [require("../models/mobile.model"), "Mobile"],
    [require("../models/electronics.model"), "Electronics"],
    [require("../models/vehicle.model"), "Vehicle"],
    [require("../models/job.model"), "Job"],
    [require("../models/furniture.model"), "Furniture"],
    [require("../models/toy.model"), "Toy"],
    [require("../models/fashion.model"), "Fashion"],
    [require("../models/takecare.model"), "TakeCare"],
    [require("../models/forsale.model"), "ForSale"],
    [require("../models/event.model"), "Event"],
    [require("../models/property.model"), "Property"],
    [require("../models/servicelisting.model"), "ServiceListing"],
    [require("../models/sports.model"), "Sports"],
    [require("../models/collectible.model"), "Collectible"],
    [require("../models/pet.model"), "Pet"],
  ];

  await Promise.all(
    models.map(([Model, name]) => migrateModelSlugs(Model, name)),
  );
}

module.exports = { migrateAllSlugs, migrateModelSlugs };
