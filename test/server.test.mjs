import assert from "node:assert/strict";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import test from "node:test";
import { WindowLimiter } from "../src/abuse-controls.mjs";
import { createEntitlementServer } from "../src/server.mjs";

const validEntry = {
  code: "SMOKE-PRIVATE-TEST",
  enabled: true,
  allowedApps: ["afon"],
  entitlementId: "theme_smoke_001",
  themeId: "smoke",
  publisherId: "mtech",
  version: "1.0.0",
  issuedAt: "2026-06-22T00:00:00.000Z",
  expiresAt: null,
  packageUrl: "https://m-techindustries.com/afon/themes/smoke/package.zip",
  sha256Url: "https://m-techindustries.com/afon/themes/smoke/package.sha256",
  packageSha256: "ea4b030d347d98ab4cac319b515f40b7ec504af6d6ef23be2d2abeb6176a9600",
  allowedPlatforms: ["android", "ios"],
  minAppVersion: "0.1.1+15"
};

const config = {
  allowedApps: ["afon"],
  allowedPlatforms: ["android", "ios"],
  minimumAppVersion: "",
  maxBodyBytes: 1024,
  rateLimitWindowMs: 60_000,
  rateLimitMaxRequests: 100,
  codeThrottleWindowMs: 60_000,
  codeThrottleMaxAttempts: 100
};

test("server exposes safe healthz route", async () => {
  await withServer(async ({ port }) => {
    const response = await send({ port, method: "GET", path: "/healthz" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json, { ok: true });
  });
});

test("server rejects non-POST methods for entitlement endpoint", async () => {
  await withServer(async ({ port }) => {
    const response = await send({ port, method: "GET", path: "/theme-entitlements" });
    assert.equal(response.statusCode, 405);
  });
});

test("server requires application/json", async () => {
  await withServer(async ({ port }) => {
    const response = await send({
      port,
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}"
    });
    assert.equal(response.statusCode, 415);
  });
});

test("server rejects oversized bodies", async () => {
  await withServer(async ({ port }) => {
    const response = await send({
      port,
      method: "POST",
      body: JSON.stringify({ code: "A".repeat(2000), app: "afon", platform: "android", appVersion: "0.1.1+15" })
    });
    assert.equal(response.statusCode, 413);
    assert.equal(response.json.valid, false);
  });
});

test("server handles malformed JSON with generic failure", async () => {
  await withServer(async ({ port }) => {
    const response = await send({ port, method: "POST", body: "{" });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json.valid, false);
    assert.deepEqual(response.json.entitlements, []);
  });
});

test("valid response omits original code and keeps packageHash compatibility", async () => {
  const logs = [];
  await withServer(async ({ port }) => {
    const response = await send({
      port,
      method: "POST",
      body: JSON.stringify(requestBody())
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json.valid, true);
    assert.equal(response.json.entitlements[0].packageHash, validEntry.packageSha256);
    assert.equal(response.json.entitlements[0].packageSha256, validEntry.packageSha256);
    assert.equal(JSON.stringify(response.json).includes(validEntry.code), false);
    assert.equal(JSON.stringify(logs).includes(validEntry.code), false);
    assert.equal(logs[0].metadata.app, "afon");
    assert.equal(logs[0].metadata.platform, "android");
    assert.equal(logs[0].metadata.result, "success");
    assert.equal(typeof logs[0].metadata.requestId, "string");
  }, { logger: (event, metadata) => logs.push({ event, metadata }) });
});

test("IP rate limit fails closed", async () => {
  await withServer(async ({ port }) => {
    const first = await send({ port, method: "POST", body: JSON.stringify(requestBody()) });
    const second = await send({ port, method: "POST", body: JSON.stringify(requestBody()) });
    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 429);
    assert.equal(second.json.valid, false);
  }, {
    ipLimiter: new WindowLimiter({ windowMs: 60_000, maxAttempts: 1 })
  });
});

test("per-code throttle fails closed", async () => {
  await withServer(async ({ port }) => {
    const first = await send({ port, method: "POST", body: JSON.stringify(requestBody()) });
    const second = await send({ port, method: "POST", body: JSON.stringify(requestBody()) });
    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 429);
    assert.equal(second.json.valid, false);
  }, {
    codeLimiter: new WindowLimiter({ windowMs: 60_000, maxAttempts: 1 })
  });
});

async function withServer(callback, overrides = {}) {
  const server = createEntitlementServer({
    config,
    loadCodes: async () => [validEntry],
    logger: () => {},
    ...overrides
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  try {
    await callback({ port });
  } finally {
    server.close();
    await once(server, "close");
  }
}

function requestBody(overrides = {}) {
  return {
    code: "smoke-private-test",
    app: "afon",
    platform: "android",
    appVersion: "0.1.1+15",
    ...overrides
  };
}

async function send({ port, method = "POST", path = "/theme-entitlements", body = "", headers = {} }) {
  const requestHeaders = {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body),
    ...headers
  };
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: "127.0.0.1", port, path, method, headers: requestHeaders }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          text,
          json: text ? JSON.parse(text) : null
        });
      });
    });
    req.on("error", reject);
    req.end(body);
  });
}
