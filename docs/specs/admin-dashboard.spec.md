# Admin Dashboard — Feature Specification
**Project:** Card Safe HQ  
**Route:** `/admin`  
**Date:** 2026-04-21  
**Status:** Partially implemented — see implementation notes per capability

---

## Scope and Context

The admin dashboard is a single-user internal tool accessible only to the account identified by
`michaelamarino16@gmail.com`. It is served at the `/admin` frontend route and backed by
`/api/admin/*` Worker endpoints. All seven capabilities below are specified in full; existing
implementation is noted inline so this document doubles as a build checklist.

**Stack constraints:**
- Cloudflare Workers + D1 (SQLite) + R2 — no server-side aggregation beyond what D1 can express
- No external metrics API available for R2 byte counts or Worker invocations without Cloudflare
  Analytics Engine or REST API calls using an API token
- Frontend: React 19 / Vite / Tailwind — tab-based SPA at `/admin`

---

## Global Security Requirement (applies to all capabilities)

**EARS:** While the admin dashboard is active, the system SHALL reject any request to
`/api/admin/*` that does not originate from a session authenticated as the admin user, returning
HTTP 403 with body `{"ok":false,"error":"Forbidden"}` and logging the attempt.

**Implementation note:** `requireAdmin(user)` in `backend/src/routes/admin.ts` currently checks
`user.email !== ADMIN_EMAIL` (hardcoded string). This MUST remain the enforcement gate — the
frontend redirect alone is not a security control. Migration to `users.is_admin = 1` column check
is tracked as a follow-up (does not block current spec).

**Acceptance criteria:**
- Given a valid session for a non-admin user, when any `GET /api/admin/*` is called, then the
  response is 403 and no data is returned
- Given no session cookie, when any `POST /api/admin/*` is called, then the response is 401
- Given the admin session, when any admin endpoint is called, then `requireAdmin` is evaluated
  before any DB query executes

**Edge cases:**
- Admin account deletion: if the admin user row is removed from D1, all admin endpoints must
  return 403 (the session will fail `getCurrentUser` upstream)
- Session expiry during an admin action: the mid-action 401 must not leave data in a partial state
  (all mutations must be atomic or idempotent)

---

## Capability 1 — View All Users and Their Collection Sizes

**EARS:** When the admin navigates to the Users or CRM tab, the system SHALL display a paginated
list of all registered users showing: user ID, email, username, registration date, plan tier,
subscription status, subscription renewal date, and total collection item count.

**Implementation status:** ✅ Backend handler `handleAdminUsers` exists and returns all fields.
✅ Frontend CRM tab renders the table with search. ❌ No pagination — full table loaded at once.
❌ No drill-down to a specific user's collection.

**Acceptance criteria:**
- Given the admin is authenticated, when `GET /api/admin/users` is called, then all users are
  returned ordered by `created_at DESC` with `collection_count` accurate to the current moment
- Given more than 200 users exist, when the CRM tab loads, then results are paginated server-side
  (page size 100) and the UI shows a page control
- Given the admin types in the search box, when at least 2 characters are entered, then the list
  filters to matching email or username substrings without a new network request (client-side
  filter over the current page)
- Given a user has no subscription record, when their row is rendered, then plan shows "Free" and
  renewal shows "—"

**Edge cases:**
- User with `NULL` username: render as "—" (already handled)
- User with cancelled Stripe subscription (`status = 'cancelled'`): show plan name with
  strikethrough or "Cancelled" badge, not "Free"
- Zero-item collection: `collection_count` = 0, not NULL

**Security requirement:** Response must not include `password_hash`. Backend query must SELECT
explicit columns, not `SELECT *`.

---

## Capability 2 — View All Collections Across All Users

**EARS:** When the admin selects a user from the Users/CRM table, the system SHALL display that
user's complete collection: all items with card name, set, condition note, estimated grade,
estimated value, front/back image thumbnails, and acquisition date, paginated at 50 items per page.

**Implementation status:** ❌ Not built. The current dashboard shows per-user item *counts* only.
No drill-down exists.

**New endpoint required:** `GET /api/admin/users/:userId/collection?page=1`

**Acceptance criteria:**
- Given the admin clicks a user row, when the collection panel opens, then items are fetched from
  `GET /api/admin/users/:userId/collection` with `page` and `limit=50` query params
- Given the collection has 0 items, when the panel opens, then "No items in this collection" is
  shown
- Given an item has `front_image_url` set, when the row renders, then a 48×48 thumbnail is shown
  (R2 key resolved via a Worker proxy endpoint that enforces admin auth before streaming the bytes)
- Given the admin clicks an item row, when the detail sheet opens, then all metadata fields are
  editable (feeds into Capability 4)
- Given `userId` does not exist in D1, when the endpoint is called, then 404 is returned

**Edge cases:**
- R2 images: the admin view must not expose R2 bucket URLs directly. Thumbnails must be fetched
  via a Worker proxy endpoint that enforces admin auth before streaming the bytes
- Very large collections (>10,000 items): server-side pagination is mandatory; client must not
  load all rows
- Items with `card_id = NULL` (not yet identified): show "Unidentified" in card name column with a
  distinct visual indicator and a shortcut to the identification override workflow (Capability 4)

**Security requirement:** The endpoint must verify the `userId` param is a valid integer and that
the requesting session is admin before executing the query. It must never accept `user_id` from the
request body — only from the validated path param.

---

## Capability 3 — Review and Manage Scan Logs and Pending Identifications

**EARS:** When the admin navigates to the Scans tab, the system SHALL display a list of all
`pending_identifications` records across all users, showing: collection item ID, owning user email,
AI suggestions, confidence score, confirmation status, and creation timestamp, filterable by status
(pending / confirmed / all) and sortable by confidence score ascending.

**Implementation status:** ❌ Not built. No scan log view or pending identification management
exists in the dashboard.

**New endpoints required:**
- `GET /api/admin/scans?status=pending|confirmed|all&page=1`
- `DELETE /api/admin/scans/:pendingId` (discard a bad identification without confirming)

**Acceptance criteria:**
- Given the admin opens the Scans tab, when the default view loads, then only `confirmed = 0`
  records are shown, ordered by `confidence_score ASC` (lowest confidence first — most likely to
  need review)
- Given the admin changes the status filter to "All", when the list refreshes, then both confirmed
  and unconfirmed records appear
- Given the admin clicks "Discard" on a pending identification, when confirmed, then the record is
  deleted and the collection item's `card_id` remains unchanged
- Given the admin clicks "View Item", when clicked, then the collection item detail opens
  (linking to Capability 4 override flow)
- Given confidence score < 50, when the row renders, then the score is highlighted in amber;
  < 20 in red

**Edge cases:**
- A collection item may have multiple pending identification records (user scanned same card twice):
  show all records grouped by `collection_item_id`, not de-duplicated
- Confirmed records: show the final confirmed `card_id` and the name it resolved to
- Deleting a pending identification for an item whose `card_id` was already set by a prior
  confirmation: warn the admin that the item is already linked; deletion only removes the log row

**Security requirement:** Discarding a pending identification (`DELETE`) must be protected by
`requireAdmin`. The delete must use `WHERE id = ?` (parameterized), never cascade to
`collection_items`.

---

## Capability 4 — Override or Correct Card Identification Data

**EARS:** When the admin selects a collection item, the system SHALL allow the admin to update any
of the following fields on the linked `cards` row or directly on the `collection_items` row:
`card_name`, `set_name`, `game`, `card_number`, `rarity`, `condition_note`, `estimated_grade`,
`estimated_value_cents`, and `card_id` (reassignment to a different card in the catalog).

**Implementation status:** ❌ Not built. The existing `PATCH /api/collection/:id` requires the
item to belong to the requesting user; admin override needs a separate endpoint that bypasses the
`user_id` filter.

**New endpoints required:**
- `PATCH /api/admin/collection/:itemId` — update any field on a collection item regardless of owner
- `PATCH /api/admin/cards/:cardId` — update shared card catalog fields
- `POST /api/admin/collection/:itemId/reassign` — change `card_id` to a different card

**Acceptance criteria:**
- Given the admin opens a collection item, when they change `estimated_grade` and save, then the
  `collection_items` row is updated and the response returns the full updated record
- Given the admin changes `card_id` to reassign an item to a different card, when saved, then
  `collection_items.card_id` is updated and any `pending_identifications` for that item are marked
  `confirmed = 1`
- Given the admin edits a shared `cards` row, when saved, then the change is reflected for all
  users whose `collection_items.card_id` points to that card — the admin is shown a warning:
  "This card is in N collections. Changes affect all owners."
- Given the admin submits an empty `card_name`, when the request arrives, then 400 is returned and
  no update occurs
- Given `itemId` does not exist, when `PATCH /api/admin/collection/:itemId` is called, then 404

**Edge cases:**
- Reassigning to a `card_id` that does not exist in `cards`: return 400 "Card not found"
- Updating a shared card that has no `collection_items` referencing it: no warning needed
- Concurrent edit: if two admin sessions edit the same item simultaneously (unlikely but possible),
  last write wins — no optimistic locking required at this scale
- R2 image keys: `front_image_url` / `back_image_url` must not be editable via the admin override
  endpoint — image management is a separate upload flow

**Security requirement:** `PATCH /api/admin/collection/:itemId` must not accept `user_id` in the
request body (would allow ownership transfer). The `user_id` column must never be mutated by this
endpoint.

---

## Capability 5 — View System Health

**EARS:** When the admin navigates to the Health tab, the system SHALL display: D1 database row
counts per table, total R2 object count and estimated storage bytes (from Cloudflare API), the
last scheduled job run time, and the count of rate-limited requests in the last hour.

**Implementation status:** ❌ Not built. The Overview tab shows application-level stats (users,
cards, scans) but not infrastructure health. R2 usage and Worker metrics require Cloudflare API
calls using an API token — these cannot be made from a D1 query.

**New endpoint required:** `GET /api/admin/health`

**Implementation approach:**
- D1 table sizes: `SELECT COUNT(*) FROM <each table>` — run in a `D1.batch()` call
- R2 usage: Cloudflare API `GET /client/v4/accounts/{account_id}/r2/buckets/{bucket}/usage`
  using `env.CLOUDFLARE_API_TOKEN` (new secret) and `env.CLOUDFLARE_ACCOUNT_ID` (new var)
- Last scheduled run: write a `system_events` table row on each `scheduled()` invocation; query
  the latest row here
- Rate limit counters: `SELECT SUM(count) FROM rate_limits WHERE expires_at > datetime('now')`

**Acceptance criteria:**
- Given the admin opens the Health tab, when the page loads, then D1 row counts for all tables are
  shown in a grid (users, cards, collection_items, sessions, sales_comps, pending_identifications,
  grading_estimates, releases, rate_limits)
- Given `CLOUDFLARE_API_TOKEN` is set, when the health endpoint is called, then R2 object count
  and storage bytes are included in the response; if the API call fails, the field shows
  "Unavailable" and does not fail the whole response
- Given the daily cron has run, when the Health tab loads, then "Last job run" shows the timestamp
  of the most recent `scheduled()` invocation
- Given more than 500 rate-limit hits occurred in the last hour, when the Health tab loads, then
  the rate-limit counter is highlighted in amber

**Edge cases:**
- `CLOUDFLARE_API_TOKEN` not configured: R2 usage fields show "Not configured" without erroring
- D1 `COUNT(*)` on a very large table: D1 full-table scans are acceptable here since this is an
  admin-only infrequent call; no index optimization required
- `system_events` table does not yet exist: return `null` for last job run rather than 500

**Security requirement:** `CLOUDFLARE_API_TOKEN` must be stored as a Wrangler secret, never in
`[vars]`. The health endpoint must be admin-only — this response reveals infrastructure details.

---

## Capability 6 — Mass Delete or Reassign Collection Items

**EARS:** When the admin selects multiple collection items from the all-collections view, the
system SHALL allow the admin to either: (a) delete all selected items and their associated R2
images, or (b) reassign all selected items to a different `card_id` in the shared catalog.

**Implementation status:** ❌ Not built. `batchDeleteCollectionItems` is imported in `index.ts`
but the admin-scoped version (bypassing `user_id` filter) does not exist.

**New endpoints required:**
- `POST /api/admin/collection/batch-delete` — body: `{ itemIds: number[] }`
- `POST /api/admin/collection/batch-reassign` — body: `{ itemIds: number[], cardId: number }`

**Acceptance criteria:**
- Given the admin selects 10 items and clicks "Delete Selected", when a confirmation dialog is
  accepted, then all 10 `collection_items` rows are deleted, their associated R2 keys
  (`front_image_url`, `back_image_url`) are deleted from the bucket, and a success toast shows
  "10 items deleted"
- Given the admin selects 5 items and clicks "Reassign to Card", when a card is chosen from the
  catalog picker and confirmed, then all 5 items have `card_id` updated and
  `pending_identifications` for those items are marked `confirmed = 1`
- Given `itemIds` contains an ID that does not exist, when the batch-delete is processed, then
  existing IDs are deleted and the response includes a `skipped` array of IDs not found — the
  operation does not abort
- Given `itemIds` is an empty array, when the endpoint is called, then 400 is returned:
  "itemIds must be a non-empty array"
- Given `itemIds` contains more than 500 IDs, when the endpoint is called, then 400 is returned:
  "Maximum 500 items per batch operation"

**Edge cases:**
- R2 delete failure: if a bucket delete fails for one key (object missing or network error), log
  the error but do not abort the D1 delete — the DB row is the source of truth
- Reassigning items whose current `card_id` is NULL: valid; update proceeds normally
- Items owned by different users in the same batch: valid for admin — the batch operation ignores
  `user_id` ownership
- Partial failure in `D1.batch()`: log which IDs were not deleted and include in the `skipped`
  response field

**Security requirement:** Both batch endpoints must validate that `itemIds` is an array of positive
integers. Reject any non-integer, zero, or negative value with 400. Never accept `user_id` in the
batch body. Execute the D1 delete using individually bound parameters, not string-interpolated IDs.

---

## Capability 7 — Manage the Shared Card Catalog and Releases

**EARS:** When the admin navigates to the Catalog tab, the system SHALL allow: creating new card
catalog entries, editing existing entries (all fields), deleting entries with a usage warning if
the card is referenced by collection items, and creating/editing/deleting release entries.

**Implementation status:** ⚠️ Partial. The Catalog tab currently supports Pokémon catalog
*seeding* (bulk import from PTCG API) and re-crop operations. It does not support manual
create/edit/delete of individual `cards` or `releases` rows. The H1 security fix now requires auth
on `POST /api/cards`, `PATCH /api/cards/:id`, `DELETE /api/cards/:id`, and `POST /api/releases`
— the admin UI should use these authenticated endpoints (no new admin-specific endpoints needed
for CRUD, but the UI must exist).

**Acceptance criteria:**

*Card catalog:*
- Given the admin opens the Catalog tab, when they click "New Card", then a form opens with
  fields: `game` (required), `card_name` (required), `set_name`, `card_number`, `rarity`,
  `image_url`, `external_ref`; submitting calls `POST /api/cards`
- Given the admin clicks "Edit" on a catalog card, when the form is submitted, then
  `PATCH /api/cards/:id` is called and the updated record is shown
- Given the admin clicks "Delete" on a catalog card that is referenced by at least one
  `collection_items` row, when the delete is attempted, then a modal warns: "This card is in N
  user collections. Deleting it will set card_id to NULL for those items. Continue?" — proceeding
  calls `DELETE /api/cards/:id`
- Given the admin deletes a card with zero collection references, then no warning is shown and the
  delete proceeds immediately

*Releases:*
- Given the admin opens the Releases section, when they click "New Release", then a form opens
  with: `game` (required), `release_name` (required), `product_type`, `release_date` (required,
  YYYY-MM-DD), `source_url`; submitting calls `POST /api/releases`
- Given the admin submits a release with an invalid date format, when the request is processed,
  then the backend returns 400 "Invalid date format. Use YYYY-MM-DD" and the form shows the error
  inline

**Edge cases:**
- Deleting a card that is the target of a pending reassign operation: the FK constraint
  `ON DELETE SET NULL` in the migration handles this at the DB level
- Duplicate card entries: the catalog has no unique constraint on `(card_name, set_name, game)` —
  the admin UI should run a duplicate-check query before insert and warn if a near-match exists
- Release `release_date` in the past: valid (for historical records); no validation block
- `image_url` field on cards: accepts any string up to 500 chars; no server-side URL fetch

**Security requirement:** All catalog mutation calls go through the standard `requireAuth`
middleware. These endpoints are currently not admin-only — any authenticated user can call them
directly. A follow-up ticket must add `requireAdmin` to catalog write endpoints or restrict them
to admin-proxied routes.

---

## Implementation Checklist

| Capability | Backend | Frontend | Status |
|---|---|---|---|
| 1. User list + sizes | ✅ `/api/admin/users` | ✅ CRM + Users tabs | Built — add pagination |
| 2. Browse all collections | ❌ `/api/admin/users/:id/collection` | ❌ Drill-down panel | Not built |
| 3. Scan logs + pending IDs | ❌ `/api/admin/scans` | ❌ Scans tab | Not built |
| 4. ID override / correction | ❌ `/api/admin/collection/:id` (admin) | ❌ Edit panel | Not built |
| 5. System health | ❌ `/api/admin/health` | ❌ Health tab | Not built |
| 6. Mass delete / reassign | ❌ `/api/admin/collection/batch-*` | ❌ Batch controls | Not built |
| 7. Catalog + releases CRUD | ⚠️ Seeding only | ⚠️ Seed UI only | Partial — add CRUD UI |

---

## Open Security Issues to Track

1. Admin check uses hardcoded email string — migrate to `users.is_admin = 1` column
2. `POST /api/cards`, `PATCH /api/cards/:id`, `DELETE /api/cards/:id`, `POST /api/releases` are
   authenticated but not admin-only — any logged-in user can mutate the shared catalog
3. SQL Runner tab (`POST /api/admin/query`) allows arbitrary SELECT queries — consider restricting
   to a read-only D1 binding or adding a query allowlist
4. R2 image proxy for admin thumbnail view does not yet exist — direct bucket URL exposure must
   be avoided when building Capability 2
