# Senshi Goju-Ryu website

KELAB KARATE DO SENSHI GOJU-RYU · C SGR-13884.

Responsive landing page, interactive dojo directory, tournament news, president updates and persistent event albums. Stack: React, Vinext, Cloudflare Workers, D1 and R2.

## Development

Node 22.13+; run `npm install`, `npm run dev`, and `npm run build`. Sites-managed environments use the supplied dependency and build helpers.

## Administration

Set runtime `ADMIN_EMAILS` to a comma-separated allowlist of approved ChatGPT account emails. Sign in at `/admin`. Every write requires authenticated allowlisted identity and same-origin submission. No default administrator or password is embedded. Uploads accept JPEG, PNG, WebP, MP4 and WebM up to 50 MB. R2 stores media and D1 stores folders and content. Only publish photos with appropriate permissions.

## Content awaiting the club

President name and approved message; dojo venues, schedules and contacts; tournament dates, results and media; joining fees and contact details. No fictional results or personal details are presented as facts.

## Deployment

The hosting manifest binds DB and BUCKET. Commit Drizzle migrations; Sites applies them during deployment. Configure ADMIN_EMAILS before enabling editorial access. The initial Site is private for review. Hostinger deployment requires an equivalent backend/database/object-storage adapter; do not deploy the Worker build as a static-only site.
