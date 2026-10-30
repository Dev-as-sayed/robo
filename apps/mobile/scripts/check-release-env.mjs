const profile = process.env.EAS_BUILD_PROFILE?.trim();

if (profile !== "production" && profile !== "preview") {
  console.log(
    "Release environment check skipped; set EAS_BUILD_PROFILE=preview or production to enforce it."
  );
  process.exit(0);
}

function fail(message) {
  console.error(`Release environment check failed: ${message}`);
  process.exit(1);
}

const raw = process.env.EXPO_PUBLIC_API_URL?.trim();

if (!raw) {
  fail(
    "EXPO_PUBLIC_API_URL is required for preview and production builds. Set it in the EAS environment."
  );
}

let url;
try {
  url = new URL(raw);
} catch {
  fail(`EXPO_PUBLIC_API_URL is not a valid URL: ${raw}`);
}

if (url.username || url.password) {
  fail("EXPO_PUBLIC_API_URL must not contain credentials.");
}

if (profile === "production" && url.protocol !== "https:") {
  fail("Production API URL must use HTTPS.");
}

const hostname = url.hostname.toLowerCase();
const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);
const privateIpv4 =
  /^10\./.test(hostname) ||
  /^192\.168\./.test(hostname) ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);

if (localHosts.has(hostname) || hostname.endsWith(".local") || privateIpv4) {
  fail(
    `EXPO_PUBLIC_API_URL points at a local address (${hostname}); use the deployed API for ${profile} builds.`
  );
}

if (url.pathname === "/" || url.pathname === "") {
  console.warn(
    "Release environment warning: EXPO_PUBLIC_API_URL has no path; expected something like /api/v1."
  );
}

console.log(
  `Release environment OK: ${profile} targets ${url.origin}${url.pathname.replace(/\/$/, "")}`
);
