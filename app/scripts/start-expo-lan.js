const os = require("os");
const { spawn } = require("child_process");

const VIRTUAL_INTERFACE_PATTERN = /vEthernet|WSL|Hyper-V|VirtualBox|VMware|Loopback|Tailscale|ZeroTier/i;
const PREFERRED_INTERFACE_PATTERN = /wi-?fi|wlan|wireless|ethernet/i;

function getIpv4Candidates() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const [name, addresses] of Object.entries(interfaces)) {
    if (!Array.isArray(addresses)) continue;

    for (const address of addresses) {
      const family = typeof address.family === "string" ? address.family : String(address.family);
      if (family !== "IPv4" || address.internal) continue;

      candidates.push({
        name,
        address: address.address,
        preferred: PREFERRED_INTERFACE_PATTERN.test(name),
        virtual: VIRTUAL_INTERFACE_PATTERN.test(name),
      });
    }
  }

  return candidates;
}

function resolveLanIp() {
  const candidates = getIpv4Candidates().filter((entry) => !entry.virtual);
  const preferred = candidates.find((entry) => entry.preferred);

  if (preferred) return preferred.address;
  if (candidates[0]) return candidates[0].address;
  return null;
}

const lanIp = resolveLanIp();
const env = { ...process.env };

if (lanIp) {
  env.REACT_NATIVE_PACKAGER_HOSTNAME = lanIp;
  console.log(`Using Expo LAN host ${lanIp}`);
} else {
  console.warn("Could not determine a LAN IPv4 address. Expo will use its default host.");
}

const expoCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(expoCommand, ["expo", "start", "--host", "lan", ...process.argv.slice(2)], {
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
