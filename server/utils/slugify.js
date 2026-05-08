/**
 * Generate a URL-friendly slug from a string.
 * Example: "Samsung Galaxy S24 Ultra 256GB" → "samsung-galaxy-s24-ultra-256gb"
 */
const generateSlug = (text) => {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
};

/**
 * Attach slug field + pre-save hook to a Mongoose schema.
 * Ensures uniqueness within the collection by appending a counter.
 */
const attachSlugPlugin = (schema) => {
  schema.add({
    slug: {
      type: String,
      index: true,
    },
  });

  schema.pre("save", async function () {
    if (!this.slug || this.isModified("title")) {
      const title = this.title || this.name || "";
      let baseSlug = generateSlug(title);
      if (!baseSlug) {
        baseSlug = this._id ? this._id.toString() : `item-${Date.now()}`;
      }
      let slug = baseSlug;
      let counter = 1;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const existing = await this.constructor.findOne({
          slug,
          _id: { $ne: this._id },
        });
        if (!existing) break;
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      this.slug = slug;
    }
  });
};

module.exports = { generateSlug, attachSlugPlugin };
