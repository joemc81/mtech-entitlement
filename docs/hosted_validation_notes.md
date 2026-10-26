# Historical Afon Entitlement Validation Notes

The earlier local/emulator checks exercised the adapter contract and theme download, hash validation, installation, and activation. Those checks did not establish a production HTTPS entitlement deployment.

The redemption values used in those checks were later found in public source and are permanently retired. This note intentionally omits the values. Do not repeat historical tests with them or treat the old results as proof that a currently deployed service is safe.

Future hosted qualification must use a protected runtime source, newly issued values, generic invalid/disabled/expired controls, and privacy-safe logs. Verify the existing `POST /theme-entitlements` response contract and production-domain theme package/hash metadata without recording submitted codes. Deployment remains Owner-gated.
