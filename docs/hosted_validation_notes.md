# Afon Theme Entitlement Hosted Validation Notes

Date: 2026-06-22

## Local Baseline

Local validation used the private entitlement adapter on `127.0.0.1:8878` with
the Android emulator reverse-mapped through ADB. This was only a development
baseline, not the hosted release path.

Validated locally:

- Adapter loaded `loadedThemeEntitlementCodes=3`.
- `SMOKE-EARLY-001` returned a valid Smoke entitlement.
- `NEBULA-EARLY-001` returned a valid Nebula entitlement.
- `ICE-EARLY-EXPIRED` returned the generic invalid/expired response.
- Invalid token returned the generic invalid/expired response.
- Smoke package downloaded, hash-validated, installed, and activated.
- Nebula package downloaded, hash-validated, installed, and activated.
- Force-stop/relaunch preserved Nebula as the active theme.
- Adapter logs contained safe metadata only: request id, app, platform,
  appVersion, result, reason, entitlementId/themeId on valid or known expired
  entries.
- No submitted redemption code appeared in adapter logs.

Important local finding:

- The original emulator failure was consistent with an app build missing
  `themeEntitlementUrl`.
- Early Smoke/Nebula package URLs previously pointed at a host that did not serve
  the ZIP packages. Commit `ab02570` corrected those private entitlement package
  URLs to the working GitHub Pages package host.

## Hosted Validation Checklist

Use the Render HTTPS host only:

```text
https://<render-host>
```

Endpoint:

```text
https://<render-host>/theme-entitlements
```

Check:

- `GET /healthz` returns `{ "ok": true }`.
- Render startup logs include `loadedThemeEntitlementCodes=3`.
- Smoke code succeeds.
- Nebula code succeeds.
- expired Ice fails generically.
- invalid token fails generically.
- Render logs do not show submitted codes or full request bodies.
- Render logs contain safe request metadata only.

Build Afon with:

```sh
--dart-define=themeEntitlementUrl=https://<render-host>/theme-entitlements
```

Before app validation, clear app data.

App validation:

- Smoke redeems, installs, and activates.
- Nebula redeems, installs, and activates.
- invalid token fails generically.
- expired Ice fails generically.
- force-stop/relaunch preserves redeemed active theme.
- raw redemption codes do not appear in app logs.
- raw redemption codes do not appear in SharedPreferences.

After hosted validation passes, replace the local-endpoint emulator build with
the hosted-endpoint build.
