---
paths:
  - "apps/api/src/db/**"
  - "apps/api/src/services/**"
  - "apps/api/src/routes/**"
---

# Data Layer Rules — Card Safe HQ (D1 + R2)

## D1 (SQLite) Query Rules
**Non-negotiable: parameterized queries always.**

```typescript
// CORRECT — always
const card = await db.prepare(
  'SELECT * FROM cards WHERE id = ? AND user_id = ?'
).bind(cardId, userId).first()

// NEVER — string interpolation is a critical vulnerability
const card = await db.prepare(
  `SELECT * FROM cards WHERE id = '${cardId}'` // SQL injection risk
).first()
```

## Row-Level Ownership
Every query touching user-owned data MUST include `AND user_id = ?`.
Never trust a record exists just because the ID was provided.

```typescript
// CORRECT — ownership enforced at query level
await db.prepare('DELETE FROM cards WHERE id = ? AND user_id = ?')
  .bind(cardId, userId).run()

// NEVER — allows any authenticated user to delete any card
await db.prepare('DELETE FROM cards WHERE id = ?')
  .bind(cardId).run()
```

## Schema Rules
- All tables: use `TEXT` UUID primary keys — never auto-increment integers for public-facing IDs
- Soft deletes: add `deleted_at DATETIME` — never hard delete user vault data
- Timestamps: `created_at` and `updated_at` on all tables — set via trigger or Worker, not client
- Sensitive fields: never store raw API keys in D1 — reference KV secret bindings instead

## R2 Storage Rules
- Path structure: `users/{user_id}/cards/{uuid}.{ext}` — user_id is server-resolved, never user-supplied
- Pre-signed URL expiry: 15 minutes for read, 5 minutes for upload
- Never generate pre-signed URLs without verifying the requesting user owns the object
- Deletion: when a card is soft-deleted, schedule R2 cleanup asynchronously — don't block the response
- Never return raw R2 URLs in API responses — always proxy through `/api/assets/{signed_token}`

## KV Usage
- Rate limit counters: `ratelimit:{type}:{identifier}` with appropriate TTL
- Session blocklist: `blocklist:{token_hash}` with TTL matching token expiry
- Cache: `cache:{resource}:{id}` — always validate ownership before serving cached data
- Never cache data across user boundaries — cache keys must include `user_id`

## Error Handling at Data Layer
- Catch all D1/R2 errors — never let raw database errors propagate to HTTP response
- Log full error context internally (Worker `console.error`) with request ID
- Return structured error to route handler: `{ code: 'DB_ERROR', message: 'internal' }`
- Route handler maps to generic HTTP response: `{ error: 'Something went wrong' }`
