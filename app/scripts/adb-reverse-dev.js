const { execSync } = require("child_process");

function run(command) {
  execSync(command, { stdio: "inherit" });
}

try {
  const devices = execSync("adb devices", { encoding: "utf8" });
  if (!/\n\s*\S+\s+device\s*$/m.test(devices)) {
    console.warn(
      "[adb] No USB device — skipping reverse. API must reach your PC over Wi-Fi (EXPO_PUBLIC_API_BASE_URL).",
    );
    process.exit(0);
  }

  run("adb reverse tcp:5000 tcp:5000");
  run("adb reverse tcp:8081 tcp:8081");
  console.log("[adb] reverse tcp:5000 and tcp:8081 → use http://127.0.0.1:5000 on device if Wi-Fi fails");
} catch {
  console.warn("[adb] reverse failed — connect phone via USB or fix Wi-Fi to your PC IP");
}
