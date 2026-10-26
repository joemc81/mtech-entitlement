# M-Tech Entitlement Adapter

Small HTTP adapter for Afon theme redemption. The contract remains `POST /theme-entitlements`; Afon must use the configured HTTPS service, not GitHub or public-pages, as the redemption authority.

Production theme ZIP and SHA-256 files are intentionally public at `m-techindustries.com`. Entitlement controls the ordinary Afon in-app unlock/install flow, not secrecy of package bytes.

## Security status

Nine previously tracked redemption records were exposed in the public repository. They are permanently retired from deployable source. `entitlements/themes/retired-records.json` retains only non-secret audit identities. This does not establish operational revocation at a live service; no production service is qualified yet. Never reuse or derive replacement values from the exposed values.

Active redemption data must be supplied outside Git. `entitlements/themes/codes.example.json` is an expired, disabled, synthetic schema illustration and cannot start the service. No current file in this repository is a production entitlement source.

## Protected source configuration

Configure exactly one of:

- `ENTITLEMENT_CODES_JSON`: schema-version-1 JSON supplied by the hosting platform's protected environment-variable facility. This is the preferred Hostinger candidate, subject to deployment qualification.
- `ENTITLEMENT_CODES_FILE`: absolute path to a protected runtime file outside the application source tree, supplied separately from Git. File delivery, access controls, and persistence must be qualified before use.

The service refuses to listen if the source is missing, malformed, empty, or has no enabled record. It does not fall back to the disabled example or any tracked file. It logs only a source-load failure category, never values or request bodies. Do not paste a real secret into a shell command, issue, report, screenshot, or test fixture. Provision replacements only after private production source and protected runtime storage are established.

Other settings: `PORT` (default `8787`), `ALLOWED_APP_IDS` (default `afon`), `ALLOWED_PLATFORMS` (default `android,ios`), `MIN_APP_VERSION` (optional), and request-rate limits in `src/config.mjs`.

## Local qualification

`npm test` uses synthetic values only. A startup test without a protected source must exit unsuccessfully before opening a port. A protected-source smoke must use a controlled synthetic, non-production input; do not test the retired values.

`GET /healthz` reports readiness only for a running process. A successful startup does not itself prove production deployment or redemption. Logs and responses must omit submitted codes. Invalid/disabled/expired values return the existing generic failure shape.

## Deployment boundary

Deployment is blocked pending Owner approval, a sanitized private M-Tech production repository, Hostinger repository-access qualification, and secure provisioning of replacement values. Do not create a Hostinger Node app, domain, DNS record, or Mobile release artifact from this source yet.
