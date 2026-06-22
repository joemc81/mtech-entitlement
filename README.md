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

## Configuration

Environment variables:

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `PORT` | No | `8787` | HTTP port for local/container runtime. |
| `ENTITLEMENT_CODES_FILE` | No | `entitlements/themes/codes.json` | Private entitlement data path. |
| `ALLOWED_APP_IDS` | No | `afon` | Comma-separated allowed app IDs. |
| `ALLOWED_PLATFORMS` | No | `android,ios` | Comma-separated allowed platform values. |
| `MIN_APP_VERSION` | No | empty | Optional global minimum Afon version. |
| `MAX_BODY_BYTES` | No | `16384` | Request body size cap. |
| `RATE_LIMIT_WINDOW_MS` | No | `60000` | Per-IP rate-limit window. |
| `RATE_LIMIT_MAX_REQUESTS` | No | `30` | Max requests per IP/window. |
| `CODE_THROTTLE_WINDOW_MS` | No | `60000` | Per-code attempt throttle window. |
| `CODE_THROTTLE_MAX_ATTEMPTS` | No | `10` | Max attempts per code/window. |

Example:

```sh
PORT=8787 \
ENTITLEMENT_CODES_FILE=entitlements/themes/codes.json \
ALLOWED_APP_IDS=afon \
ALLOWED_PLATFORMS=android,ios \
MIN_APP_VERSION=0.1.1+15 \
npm start
```

## Sample Curl

```sh
curl -sS \
  -X POST \
  -H 'content-type: application/json' \
  https://<host>/theme-entitlements \
  -d '{
    "code": "<private-code>",
    "app": "afon",
    "platform": "android",
    "appVersion": "0.1.1+15"
  }'
```

The response never includes the submitted code.

## Afon Build Flag

Afon build/run config must use the adapter URL:

```sh
--dart-define=themeEntitlementUrl=https://<host>/theme-entitlements
```

Do not configure Afon to read this repository or any GitHub URL directly.

## Security Notes

- `/theme-entitlements` accepts only `POST`.
- Requests must use `content-type: application/json`.
- Oversized or malformed bodies fail closed.
- Invalid, expired, disabled, wrong-app, and wrong-platform codes return the same
  generic failure shape.
- Logs exclude submitted codes and request bodies.
- Logs include request id, app, platform, app version, result, reason, and theme id
  only when available.
