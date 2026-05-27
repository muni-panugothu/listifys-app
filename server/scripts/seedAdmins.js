/**
 * Admin Seed Script
 * 
 * Seeds the founding team as admin users.
 * Run: node scripts/seedAdmins.js
 * 
 * Creates admin accounts if they don't exist, or promotes existing users.
 * 
 * Configure via .env:
 *   ADMIN_SEED_PASSWORD=OptionalSharedPassword
 *   ADMIN_SEED_ACCOUNTS=Name1:email1@example.com:Password1,Name2:email2@example.com:Password2
 *   ADMIN_SEED_UPDATE_EXISTING_PASSWORDS=true
 * 
 * Or use the built-in defaults below (override password via env for production).
 */
const path = require("path");
const mongoose = require("mongoose");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { logger } = require("../utils/logger");

// ── Admin accounts to seed ────────────────────────────────────────
// Optional shared fallback password (used only when an account entry has no password).
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD;
if (!ADMIN_PASSWORD) {
  logger.error("❌ ADMIN_SEED_PASSWORD must be set in .env — refusing to use a hardcoded default.");
  process.exit(1);
}
const UPDATE_EXISTING_PASSWORDS =
  String(process.env.ADMIN_SEED_UPDATE_EXISTING_PASSWORDS || "false").toLowerCase() === "true";

// Default admin accounts (can be overridden via ADMIN_SEED_ACCOUNTS env var)
const DEFAULT_ADMINS = [
  { name: "Panugothu Muni", email: "panugothumuni258@gmail.com" },
  { name: "Satish Madhula", email: "satishmadhula9@gmail.com" },
  { name: "Ravi Kumar", email: "ravikumar.listify@gmail.com" },
  { name: "Priya Sharma", email: "priyasharma.listify@gmail.com" },
  { name: "Vikram Reddy", email: "vikramreddy.listify@gmail.com" },
];

function getAdminAccounts() {
  const envAccounts = process.env.ADMIN_SEED_ACCOUNTS;

  const resolvePassword = (entryPassword) => {
    const direct = (entryPassword || "").trim();
    if (direct) return direct;
    return ADMIN_PASSWORD;
  };

  if (envAccounts) {
    // Format: "Name1:email1@example.com:Password1,Name2:email2@example.com:Password2"
    // Password is optional per entry; falls back to ADMIN_SEED_PASSWORD.
    return envAccounts.split(",").map((entry) => {
      const [name, email, password] = entry.trim().split(":");
      if (!name || !email) {
        logger.error(`❌ Invalid ADMIN_SEED_ACCOUNTS entry: "${entry}"`);
        process.exit(1);
      }
      return {
        name: name.trim(),
        email: email.trim(),
        password: resolvePassword(password),
        role: "admin",
      };
    });
  }
  return DEFAULT_ADMINS.map((a) => ({
    ...a,
    password: resolvePassword(a.password),
    role: "admin",
  }));
}

async function seedAdmins() {
  const dbUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!dbUri) {
    logger.error("❌ MONGO_URI not set in environment. Check your .env file.");
    process.exit(1);
  }

  await mongoose.connect(dbUri);
  logger.error("✅ Connected to MongoDB");

  const User = require("../models/user.model");
  const ADMIN_ACCOUNTS = getAdminAccounts();

  logger.error(`\n📋 Seeding ${ADMIN_ACCOUNTS.length} admin account(s)...\n`);

  for (const admin of ADMIN_ACCOUNTS) {
    const existing = await User.findOne({ email: admin.email });

    if (existing) {
      let changed = false;

      if (existing.role !== "admin") {
        existing.role = "admin";
        changed = true;
      }

      // Optional: align existing users to provided seed password(s)
      if (UPDATE_EXISTING_PASSWORDS && admin.password) {
        existing.password = admin.password;
        existing.provider = "local";
        existing.isVerified = true;
        changed = true;
      }

      if (changed) {
        await existing.save();
        const passwordMsg = UPDATE_EXISTING_PASSWORDS
          ? " and password updated"
          : "";
        logger.error(`✅ ${admin.email} updated (admin role${passwordMsg})`);
      } else {
        logger.error(`✓  ${admin.email} is already admin`);
      }
    } else {
      // Create new admin account
      const newUser = new User({
        name: admin.name,
        email: admin.email,
        password: admin.password, // Will be hashed by pre-save hook (Argon2id)
        role: "admin",
        isVerified: true,
        status: "active",
        provider: "local",
      });
      await newUser.save();
      logger.error(`✅ ${admin.email} — admin account CREATED`);
    }
  }

  await mongoose.disconnect();
  logger.error("\n🎉 Admin seeding complete");
  logger.error("📌 Login at /signin with admin email & password");
  logger.error("📌 After login, click profile → 'Admin Panel' (purple)");
}

seedAdmins().catch((err) => {
  logger.error("❌ Error:", err);
  process.exit(1);
});
