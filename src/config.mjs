const DEFAULT_CODES_FILE = "entitlements/themes/codes.json";

export function loadConfig(env = process.env) {
  return {
    port: integerEnv(env.PORT, 8787),
    entitlementCodesFile: env.ENTITLEMENT_CODES_FILE || DEFAULT_CODES_FILE,
    allowedApps: csvEnv(env.ALLOWED_APP_IDS, ["afon"]).map((value) => value.toLowerCase()),
    allowedPlatforms: csvEnv(env.ALLOWED_PLATFORMS, ["android", "ios"]).map((value) => value.toLowerCase()),
    minimumAppVersion: env.MIN_APP_VERSION || "",
    maxBodyBytes: integerEnv(env.MAX_BODY_BYTES, 16 * 1024),
    rateLimitWindowMs: integerEnv(env.RATE_LIMIT_WINDOW_MS, 60_000),
    rateLimitMaxRequests: integerEnv(env.RATE_LIMIT_MAX_REQUESTS, 30),
    codeThrottleWindowMs: integerEnv(env.CODE_THROTTLE_WINDOW_MS, 60_000),
    codeThrottleMaxAttempts: integerEnv(env.CODE_THROTTLE_MAX_ATTEMPTS, 10)
  };
}

function csvEnv(value, fallback) {
  if (typeof value !== "string" || value.trim().length === 0) return fallback;
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function integerEnv(value, fallback) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
