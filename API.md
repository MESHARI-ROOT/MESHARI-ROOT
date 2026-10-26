# MESHARI-ALOTAIBI API

The frontend and API deploy together on Netlify. The API uses PostgreSQL, server-side sessions and HttpOnly cookies. Admin initialization requires the existing setup environment variables; never put them in browser code or GitHub.

## Client flow

1. `POST /api/auth/client` with JSON `{ "code": "<9 digits>" }`.
2. `GET /api/me/subscription` returns the current subscription status, expiry, remaining days and accessible published-file count. Expired, disabled or revoked sessions return 401. Admin sessions receive `status: "owner"`.
3. `GET /api/scripts` lists the files accessible to that session. This list also appears directly in the installation page after login.
4. `GET /api/scripts/:id` returns metadata, instructions and the expected SHA-256.
5. `GET /api/scripts/:id/download` checks current permissions again and returns the original file with `X-Content-SHA256`. The browser verifies the downloaded bytes before saving.
6. `POST /api/auth/logout` revokes the session.

Mutating requests require same-origin `Origin`, JSON Content-Type and `X-Zen-Request: 1`. Session cookies are sent automatically by the same-origin frontend. Do not put the customer's code in a URL or log it.

The public `/api/catalog` and `/api/free-scripts/:id[/download]` routes expose only published free files. Public free files remain public after a subscription expires; paid and private files do not.

## Owner operations

Existing `/api/admin/clients` routes create, edit, renew and disable subscriptions, assign files, rotate codes and revoke sessions. `/api/admin/dashboard`, `/api/admin/audit` and `/api/admin/sessions` provide counts and activity. Codes are stored as keyed hashes; the full code is not returned by the API.

## Device operations and limitations

USB access runs on the customer's computer through WebHID, not on the Netlify server. The first permission requires an explicit customer click. Previously permitted devices can be rediscovered with `getDevices()` and reconnect events. Detection does not prove authenticity, firmware version or successful installation.

This repository DOES NOT contain a GPC compiler or a verified Cronus slot-writing/firmware protocol. It provides files, access control, guidance and detection. Do not add an installation-success response without implementing and verifying the hardware operation. Current programming uses the official Zen Studio Live tool.

References:
- https://developer.chrome.com/docs/extensions/how-to/web-platform/webhid
- https://zenstudio.collectivemindsstore.com/
- https://guide.cronuszen.com/quick-start-and-downloads/step-1-start-zen-studio-live
