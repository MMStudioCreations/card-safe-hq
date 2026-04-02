**---
paths:
  - "apps/api/src/auth/**"
  - "apps/api/src/middleware/**"
  - "apps/web/src/hooks/useAuth*"
  - "apps/web/src/pages/auth/**"
---

# Auth Rules — Card Safe HQ

## Token Strategy
- Access tokens: short-lived JWTs (15 min expiry) stored in memory (React state) only
- Refresh tokens: long-lived (7 days), stored in httpOnly, Secure, SameSite=Strict cookies
- On every access token use: verify signature, expiry, and `iss`/`aud` claims
- Refresh token rotation: issue a new refresh token on every refresh — invalidate the old one
- On logout: invalidate refresh token server-side (KV blocklist) — don't just clear the cookie

## Session Rules
- Never expose user_id directly in URLs — use session context to resolve identity
- Store active session metadata in KV: `sessions:{refresh_token_hash}` → `{user_id, created_at, ip}`
- Detect suspicious refresh: if IP changes dramatically, require re-auth
- Sessions expire after 30 days of inactivity regardless of refresh token validity

## Auth Middleware (Workers)
Every protected route MUST run this middleware chain in order:
1. Extract Bearer token from `Authorization` header
2. Verify JWT signature with `WORKER_JWT_SECRET` binding
3. Check token expiry — reject with `401` if expired, not `403`
4. Check KV blocklist for revoked tokens
5. Attach `user_id` to request context — never re-parse from body or params

```typescript
// Correct pattern — always do this
const userId = c.get('userId') // from middleware context

// Never do this
const userId = body.user_id // user-supplied — cannot trust
```

## Login/Signup Endpoint Rules
- Hash passwords with bcrypt (cost factor 12) — never MD5, SHA1, or unsalted SHA256
- On failed login: return generic `"Invalid credentials"` — never specify which field was wrong
- After 5 failed attempts: lock account for 15 min, notify user via email
- On signup: validate email format, enforce password strength (min 12 chars, mixed case, number)
- Never log passwords, tokens, or raw credentials at any level

## OAuth (if added later)
- Validate `state` parameter on callback to prevent CSRF
- Verify `aud` claim matches Card Safe HQ client ID
- Never store OAuth access tokens in DB — exchange for internal session immediately
**
