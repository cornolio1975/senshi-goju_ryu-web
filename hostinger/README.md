# Hostinger subfolder edition

A standalone React frontend and PHP 8.3/SQLite backend for
`https://spsportdatasolution.org/clubs/senshi_goju-ryu/`.
The existing Cloudflare edition remains in the repository root.

## Build

From `hostinger/`: `npm ci && npm run build`.
The build derives the landing page and styles from the main application,
replacing root-relative assets and APIs with subfolder-relative paths.
Upload the contents of `dist/` directly into `public_html/clubs/senshi_goju-ryu/`.
Keep the supplied `.htaccess`. Do not upload this source directory or node_modules.

## Initial configuration

Create `dist/config.php` before first upload:

```php
<?php
if (!defined('SENSHI_CONFIG')) { http_response_code(404); exit; }
return ['hash' => 'REPLACE_WITH_PASSWORD_HASH'];
```

Generate a unique initial password hash using PHP's
`password_hash($password, PASSWORD_DEFAULT)` without printing the password.
The deployment prepared on 2 November 2026 has its own randomly generated
credential, delivered separately to the owner. No password is committed.
Once initialized, the SQLite settings record controls the password.
Changing config.php after initialization does not reset it.

## Runtime and security

- PHP `pdo_sqlite`, `fileinfo`, `mbstring`, and sessions are required.
- Store DB/media outside public_html at
  `domains/spsportdatasolution.org/.senshi-goju-ryu/` (derived from api.php).
- Include the entire data directory in hosting backups. Restore it together
  with the deployed files; never package it in a public ZIP.
- Unique admin password, HttpOnly/Secure/SameSite session cookie,
  30-minute inactivity timeout, server-side CSRF and origin checks.
- Login attempts are limited to five failures per IP per 15 minutes.
- Password changes invalidate other existing sessions.
- Upload MIME comes from file contents. Allowed: JPEG/PNG/WebP/MP4/WebM,
  at most 50 MiB. Files use random names and are served through PHP.
- Video requests support single byte ranges.
- Anonymous visitors can read published content but cannot modify it.
- Configure PHP post_max_size greater than 50 MiB and
  upload_max_filesize at least 50 MiB.

No Cloudflare service or Sites-authentication header is trusted by this edition.
For a different hostname or path, update origin and session path in api.php
and RewriteBase in .htaccess before building.

## Bulletin board and password controls

Admin Centre includes scheduled club/branch bulletins and show/hide controls
for password fields. Bulletin launch and close inputs use Malaysia time
(Asia/Kuala_Lumpur, UTC+08:00). Only enabled bulletins inside their active
window are returned publicly; launch is inclusive and close is exclusive.
Public pages poll every 30 seconds and hide expired items every second.
The PHP API adds its bulletin table automatically without replacing existing
club data or credentials. No cron task is needed.
