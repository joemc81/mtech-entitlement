import assert from "node:assert/strict";
import test from "node:test";
import { validateThemeCode } from "../src/entitlement-adapter.mjs";

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

function request(overrides = {}) {
  return {
    code: "smoke-private-test",
    app: "afon",
    platform: "android",
    appVersion: "0.1.1+15",
    ...overrides
  };
}

test("valid code returns normalized entitlement without original code", async () => {
  const logs = [];
  const response = await validateThemeCode(request(), {
    loadCodes: async () => [validEntry],
    logger: (event, metadata) => logs.push({ event, metadata })
  });

  assert.equal(response.valid, true);
  assert.equal(response.entitlements[0].entitlementId, "theme_smoke_001");
  assert.equal(response.entitlements[0].themeId, "smoke");
  assert.equal(response.entitlements[0].packageSha256, validEntry.packageSha256);
  assert.equal(response.entitlements[0].packageHash, validEntry.packageSha256);
  assert.equal(JSON.stringify(response).includes("SMOKE-PRIVATE-TEST"), false);
  assert.equal(JSON.stringify(logs).includes("SMOKE-PRIVATE-TEST"), false);
  assert.match(logs[0].metadata.requestId, /^$/);
  assert.deepEqual({ ...logs[0].metadata, requestId: "" }, {
    requestId: "",
    app: "afon",
    entitlementId: "theme_smoke_001",
    themeId: "smoke",
    platform: "android",
    appVersion: "0.1.1+15",
    result: "success",
    reason: "valid"
  });
});

test("missing code fails closed with no entitlement", async () => {
  const response = await validateThemeCode(request({ code: "" }), {
    loadCodes: async () => [validEntry],
    logger: () => {}
  });

  assert.equal(response.valid, false);
  assert.deepEqual(response.entitlements, []);
});

test("wrong app fails closed", async () => {
  const response = await validateThemeCode(request({ app: "other" }), {
    loadCodes: async () => [validEntry],
    logger: () => {}
  });

  assert.equal(response.valid, false);
  assert.deepEqual(response.entitlements, []);
});

test("unsupported platform fails closed", async () => {
  const response = await validateThemeCode(request({ platform: "linux" }), {
    loadCodes: async () => [validEntry],
    logger: () => {}
  });

  assert.equal(response.valid, false);
  assert.deepEqual(response.entitlements, []);
});

test("expired code fails closed", async () => {
  const response = await validateThemeCode(request(), {
    loadCodes: async () => [{ ...validEntry, expiresAt: "2020-01-01T00:00:00.000Z" }],
    now: () => new Date("2026-06-22T00:00:00.000Z"),
    logger: () => {}
  });

  assert.equal(response.valid, false);
  assert.deepEqual(response.entitlements, []);
});

test("platform and app version gates are enforced", async () => {
  const iosDenied = await validateThemeCode(request({ platform: "linux" }), {
    loadCodes: async () => [validEntry],
    logger: () => {}
  });
  const oldApp = await validateThemeCode(request({ appVersion: "0.1.1+14" }), {
    loadCodes: async () => [validEntry],
    logger: () => {}
  });

  assert.equal(iosDenied.valid, false);
  assert.equal(oldApp.valid, false);
});

test("environment minimum app version is enforced", async () => {
  const response = await validateThemeCode(request({ appVersion: "0.1.1+14" }), {
    loadCodes: async () => [{ ...validEntry, minAppVersion: undefined }],
    config: {
      allowedApps: ["afon"],
      allowedPlatforms: ["android", "ios"],
      minimumAppVersion: "0.1.1+15"
    },
    logger: () => {}
  });

  assert.equal(response.valid, false);
});
