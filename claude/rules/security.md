---
paths:
  - "apps/api/**"
  - "apps/web/src/**"
  - "packages/shared/**"
---

# Security Rules — Card Safe HQ

## Mandatory Security Checklist
Before completing any function, verify:
- [ ] All user inputs sanitized and validated server-side
- [ ] No string concatenation in SQL queries (use `?` placeholders)
- [ ] Auth middleware applied to this route
- [ ] Error messages are generic to client, detailed to logs only
- [ ] No sensitive data in response payloads beyond what's needed

## Input Validation
- Strip and reject unexpected fields before any DB write — use explicit allow-lists
- Validate and sanitize ALL inputs: strings (length, charset), numbers (range), UUIDs (format)
- Reject requests with unexpected or missing `Content-Type` headers on POST/PUT
- Sanitize any external data before rendering (eBay comps, card descriptions, image metadata)

## Rate Limiting
- Login/signup: max 5 attempts per IP per 15 minutes — use KV-backed counter in Workers
- Card scan (Claude Vision): max 20 requests per user per hour
- eBay comps fetch: max 50 requests per user per day
- Public endpoints: max 100 requests per IP per minute via Cloudflare Rate Limiting rules
- On limit exceeded: return `429` with `Retry-After` header — never silently drop

## CORS
- Enforce strict CORS: whitelist only `https://cardsafehq.com` and `http://localhost:5173` (dev)
- Reject all requests from unlisted origins — return `403`, not silent failure
- Never use `Access-Control-Allow-Origin: *` on any authenticated route

## Headers (via Cloudflare Pages `_headers`)
All routes must include:
```
Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## API Response Rules
- Never include internal field names, DB column names, or stack traces in responses
- Never expose sequential integer IDs — use UUIDs or opaque slugs for all public-facing IDs
- Strip `null` fields and internal metadata before sending JSON responses
- Validate response shape before returning — don't forward raw DB rows

## File Uploads (Card Images → R2)
- Validate MIME type server-side (not just extension) — accept only `image/jpeg`, `image/png`, `image/webp`
- Enforce max file size: 10MB per image
- Serve all R2 assets through a Worker with signed URLs — never expose the bucket URL
- Scan filename for path traversal attempts before storing
- Store files under `users/{user_id}/cards/{uuid}.{ext}` — never use user-supplied filenames
