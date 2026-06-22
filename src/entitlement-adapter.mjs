import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfig } from "./config.mjs";

const DEFAULT_CODES_FILE = "entitlements/themes/codes.json";
const SAFE_CODE_PATTERN = /^[A-Za-z0-9._-]{4,120}$/;
const SAFE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/;

export async function loadThemeCodes(path = process.env.ENTITLEMENT_CODES_FILE || DEFAULT_CODES_FILE) {
  const raw = await readFile(resolve(path), "utf8");
  const decoded = JSON.parse(raw);
  if (!decoded || decoded.schemaVersion !== 1 || !Array.isArray(decoded.codes)) {
    throw new Error("Invalid theme entitlement code data.");
  }
  return decoded.codes;
}

export async function validateThemeCode(request, { loadCodes = loadThemeCodes, now = () => new Date(), logger = safeLog, requestId = "", config = loadConfig() } = {}) {
  const normalized = normalizeRequest(request, config);
  if (!normalized.ok) {
    logger("theme_entitlement_validation", {
      requestId,
      app: normalized.app,
      platform: normalized.platform,
      appVersion: normalized.appVersion,
      result: "failure",
      reason: normalized.reason
    });
    return invalidResponse("Invalid or expired code.");
  }

  const codes = await loadCodes();
  const match = codes.find((entry) => normalizeCode(entry.code) === normalized.code);
  if (!match) {
    logger("theme_entitlement_validation", {
      requestId,
      app: normalized.app,
      platform: normalized.platform,
      appVersion: normalized.appVersion,
      result: "failure",
      reason: "code_not_found"
    });
    return invalidResponse("Invalid or expired code.");
  }

  const decision = validateEntry(match, normalized, now());
  if (!decision.ok) {
    logger("theme_entitlement_validation", {
      requestId,
      app: normalized.app,
      entitlementId: safeValue(match.entitlementId),
      themeId: safeValue(match.themeId),
      platform: normalized.platform,
      appVersion: normalized.appVersion,
      result: "failure",
      reason: decision.reason
    });
    return invalidResponse("Invalid or expired code.");
  }

  const grant = normalizedGrant(match);
  logger("theme_entitlement_validation", {
    requestId,
    app: normalized.app,
    entitlementId: grant.entitlementId,
    themeId: grant.themeId,
    platform: normalized.platform,
    appVersion: normalized.appVersion,
    result: "success",
    reason: "valid"
  });
  return {
    valid: true,
    entitlements: [grant],
    message: "Theme unlocked."
  };
}

function normalizeRequest(value, config) {
  const code = normalizeCode(value?.code);
  const app = safeValue(value?.app).toLowerCase();
  const platform = safeValue(value?.platform).toLowerCase();
  const appVersion = safeValue(value?.appVersion);
  if (!SAFE_CODE_PATTERN.test(code)) {
    return { ok: false, app, platform, appVersion, reason: "invalid_code_format" };
  }
  if (!config.allowedApps.includes(app)) {
    return { ok: false, app, platform, appVersion, reason: "invalid_app" };
  }
  if (!config.allowedPlatforms.includes(platform)) {
    return { ok: false, app, platform, appVersion, reason: "invalid_platform" };
  }
  if (appVersion.length === 0 || appVersion.length > 64) {
    return { ok: false, app, platform, appVersion, reason: "invalid_app_version" };
  }
  if (config.minimumAppVersion && compareVersions(appVersion, config.minimumAppVersion) < 0) {
    return { ok: false, app, platform, appVersion, reason: "app_version_too_old" };
  }
  return { ok: true, code, app, platform, appVersion };
}

function validateEntry(entry, request, now) {
  if (entry?.enabled !== true) return { ok: false, reason: "code_disabled" };
  if (safeValue(entry.app).toLowerCase() !== request.app) return { ok: false, reason: "app_mismatch" };
  if (!SAFE_ID_PATTERN.test(safeValue(entry.entitlementId))) return { ok: false, reason: "invalid_entitlement_id" };
  if (!SAFE_ID_PATTERN.test(safeValue(entry.themeId))) return { ok: false, reason: "invalid_theme_id" };
  if (!SAFE_ID_PATTERN.test(safeValue(entry.publisherId))) return { ok: false, reason: "invalid_publisher_id" };
  if (Array.isArray(entry.allowedPlatforms) && !entry.allowedPlatforms.map((item) => safeValue(item).toLowerCase()).includes(request.platform)) {
    return { ok: false, reason: "platform_not_allowed" };
  }
  if (entry.minAppVersion && compareVersions(request.appVersion, safeValue(entry.minAppVersion)) < 0) {
    return { ok: false, reason: "app_version_too_old" };
  }
  const expiresAt = parseOptionalDate(entry.expiresAt);
  if (expiresAt && expiresAt <= now) return { ok: false, reason: "code_expired" };
  if (!isHttpsUrl(entry.packageUrl) || !isHttpsUrl(entry.sha256Url)) return { ok: false, reason: "invalid_package_url" };
  if (!/^[a-fA-F0-9]{64}$/.test(safeValue(entry.packageSha256))) return { ok: false, reason: "invalid_package_sha256" };
  return { ok: true };
}

function normalizedGrant(entry) {
  const packageSha256 = safeValue(entry.packageSha256).toLowerCase();
  return withoutNullish({
    entitlementId: safeValue(entry.entitlementId),
    themeId: safeValue(entry.themeId),
    publisherId: safeValue(entry.publisherId),
    version: safeValue(entry.version || "1.0.0"),
    issuedAt: safeValue(entry.issuedAt || new Date(0).toISOString()),
    expiresAt: entry.expiresAt || null,
    packageUrl: safeValue(entry.packageUrl),
    sha256Url: safeValue(entry.sha256Url),
    packageSha256,
    packageHash: packageSha256
  });
}

function invalidResponse(message) {
  return {
    valid: false,
    entitlements: [],
    message
  };
}

function safeLog(event, metadata) {
  console.info(JSON.stringify({ event, ...metadata }));
}

function normalizeCode(value) {
  return safeValue(value).trim().toUpperCase();
}

function safeValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseOptionalDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isHttpsUrl(value) {
  try {
    const uri = new URL(safeValue(value));
    return uri.protocol === "https:" && uri.hostname.length > 0 && uri.username === "" && uri.password === "";
  } catch {
    return false;
  }
}

function withoutNullish(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function compareVersions(left, right) {
  const leftParts = splitVersion(left);
  const rightParts = splitVersion(right);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function splitVersion(value) {
  return safeValue(value)
    .split(/[.+-]/)
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));
}
