/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const signingDir = path.join(__dirname, "..", "signing");
const keytool =
  process.env.KEYTOOL_PATH ||
  (process.platform === "win32" ? "keytool" : "keytool");

function readReleasePassword() {
  const passFile = path.join(signingDir, "release-password.txt");
  if (fs.existsSync(passFile)) {
    return fs.readFileSync(passFile, "utf8").trim();
  }
  return process.env.LISTIFYS_RELEASE_KEYSTORE_PASSWORD || "";
}

function printFingerprint(label, keystorePath, alias, storepass) {
  if (!fs.existsSync(keystorePath)) {
    console.log(`\n${label}: missing ${keystorePath}`);
    return;
  }

  const output = execSync(
    `"${keytool}" -list -v -keystore "${keystorePath}" -alias ${alias} -storepass ${storepass}`,
    { encoding: "utf8" },
  );

  const sha1 = output.match(/SHA1:\s*(.+)/i)?.[1]?.trim();
  const sha256 = output.match(/SHA256:\s*(.+)/i)?.[1]?.trim();

  console.log(`\n${label}`);
  console.log(`  keystore: ${keystorePath}`);
  console.log(`  alias:    ${alias}`);
  if (sha1) console.log(`  SHA-1:    ${sha1}`);
  if (sha256) console.log(`  SHA-256:  ${sha256}`);
}

console.log("Listifys Android signing fingerprints");
console.log("Add SHA-1 values in Google Cloud Console → APIs & Services → Credentials");
console.log("→ Android client for com.listifys.app");

printFingerprint(
  "Debug (expo run:android)",
  path.join(signingDir, "debug.keystore"),
  "androiddebugkey",
  "android",
);

const releasePass = readReleasePassword();
if (releasePass) {
  printFingerprint(
    "Release (EAS / store builds)",
    path.join(signingDir, "release.keystore"),
    "listifys-release",
    releasePass,
  );
} else {
  console.log("\nRelease: set LISTIFYS_RELEASE_KEYSTORE_PASSWORD or signing/release-password.txt");
}
