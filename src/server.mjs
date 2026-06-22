import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { WindowLimiter, codeThrottleKey } from "./abuse-controls.mjs";
import { loadConfig } from "./config.mjs";
import { loadThemeCodes, validateThemeCode } from "./entitlement-adapter.mjs";

const config = loadConfig();

export function createEntitlementServer({
  config = loadConfig(),
  logger = safeLog,
  loadCodes,
  ipLimiter = new WindowLimiter({
    windowMs: config.rateLimitWindowMs,
    maxAttempts: config.rateLimitMaxRequests
  }),
  codeLimiter = new WindowLimiter({
    windowMs: config.codeThrottleWindowMs,
    maxAttempts: config.codeThrottleMaxAttempts
  })
} = {}) {
  const codeLoader = loadCodes || (() => loadThemeCodes(config.entitlementCodesFile));
  return createServer(async (request, response) => {
    const requestId = randomUUID();
    try {
      if (request.method === "GET" && isHealthPath(request.url)) {
        return sendJson(response, 200, { ok: true });
      }
      if (request.url !== "/theme-entitlements") {
        return sendJson(response, 404, { error: "not_found", requestId });
      }
      if (request.method !== "POST") {
        return sendJson(response, 405, { error: "method_not_allowed", requestId }, { allow: "POST" });
      }
      if (!hasJsonContentType(request.headers["content-type"])) {
        return sendJson(response, 415, { error: "unsupported_media_type", requestId });
      }

      const clientIp = clientIpFor(request);
      const ipDecision = ipLimiter.check(clientIp);
      if (!ipDecision.allowed) {
        logger("theme_entitlement_request", {
          requestId,
          app: "",
          platform: "",
          appVersion: "",
          result: "failure",
          reason: "rate_limited"
        });
        return sendJson(response, 429, genericFailure(requestId));
      }

      const body = await readJsonBody(request, config.maxBodyBytes);
      const codeDecision = codeLimiter.check(codeThrottleKey(body?.code));
      if (!codeDecision.allowed) {
        logger("theme_entitlement_request", {
          requestId,
          app: safeValue(body?.app).toLowerCase(),
          platform: safeValue(body?.platform).toLowerCase(),
          appVersion: safeValue(body?.appVersion),
          result: "failure",
          reason: "code_throttled"
        });
        return sendJson(response, 429, genericFailure(requestId));
      }

      const result = await validateThemeCode(body, {
        loadCodes: codeLoader,
        logger,
        requestId,
        config
      });
      return sendJson(response, 200, { ...result, requestId });
    } catch (error) {
      const reason = error?.message === "request_too_large" ? "request_too_large" : "invalid_request";
      logger("theme_entitlement_request", {
        requestId,
        app: "",
        platform: "",
        appVersion: "",
        result: "failure",
        reason
      });
      const statusCode = reason === "request_too_large" ? 413 : 400;
      return sendJson(response, statusCode, genericFailure(requestId));
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createEntitlementServer({ config });
  server.listen(config.port, () => {
    loadThemeCodes(config.entitlementCodesFile)
      .then((codes) => {
        safeLog("theme_entitlement_codes_loaded", {
          loadedThemeEntitlementCodes: codes.length,
          entitlementCodesFile: config.entitlementCodesFile
        });
      })
      .catch(() => {
        safeLog("theme_entitlement_codes_load_failed", {
          loadedThemeEntitlementCodes: 0,
          entitlementCodesFile: config.entitlementCodesFile
        });
      });
    safeLog("entitlement_adapter_started", { port: config.port });
  });
}

function sendJson(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers
  });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request, maxBodyBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) {
      throw new Error("request_too_large");
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function genericFailure(requestId) {
  return {
    valid: false,
    entitlements: [],
    message: "Invalid or expired code.",
    requestId
  };
}

function hasJsonContentType(value) {
  return typeof value === "string" && value.toLowerCase().split(";")[0].trim() === "application/json";
}

function isHealthPath(value) {
  return value === "/healthz" || value === "/health";
}

function clientIpFor(request) {
  const forwardedFor = request.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }
  return request.socket.remoteAddress || "unknown";
}

function safeValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeLog(event, metadata) {
  console.info(JSON.stringify({ event, ...metadata }));
}
