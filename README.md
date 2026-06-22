# M-Tech Entitlement Adapter

Private entitlement data and a small HTTP adapter for Afon theme redemption.

Runtime flow:

```text
Afon -> themeEntitlementUrl -> entitlement adapter/service -> private mtech-entitlement repo data
```

Do not point Afon directly at GitHub. Do not put GitHub credentials or redemption
codes in the mobile app or public-pages.

## Endpoint

`POST /theme-entitlements`

Request:

```json
{
  "code": "<user entered code>",
  "app": "afon",
  "platform": "android",
  "appVersion": "0.1.1+15"
}
```

Success:

```json
{
  "valid": true,
  "entitlements": [
    {
      "entitlementId": "theme_smoke_001",
      "themeId": "smoke",
      "publisherId": "mtech",
      "version": "1.0.0",
      "issuedAt": "2026-06-22T00:00:00.000Z",
      "expiresAt": null,
      "packageUrl": "https://m-techindustries.com/afon/themes/smoke/package.zip",
      "sha256Url": "https://m-techindustries.com/afon/themes/smoke/package.sha256",
      "packageSha256": "<sha256>",
      "packageHash": "<sha256>"
    }
  ],
  "message": "Theme unlocked."
}
```

Failure:

```json
{
  "valid": false,
  "entitlements": [],
  "message": "Invalid or expired code."
}
```

The adapter never returns the original redemption code. Logs must stay limited to
safe metadata: entitlement id, theme id, platform, app version, success/failure
reason.

## Data

Private code data lives at:

```text
entitlements/themes/codes.json
```

Use `entitlements/themes/codes.example.json` as the schema reference. Keep this
repository private.

## Local Run

```sh
npm test
npm start
```

Optional environment:

```sh
PORT=8787
ENTITLEMENT_CODES_FILE=entitlements/themes/codes.json
```

Afon build/run config must use the adapter URL:

```sh
--dart-define=themeEntitlementUrl=https://<mtech-entitlement-endpoint>/theme-entitlements
```
