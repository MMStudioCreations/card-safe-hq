# Implementation Plan — Admin Dashboard
**Spec:** `docs/specs/admin-dashboard.spec.md`  
**Date:** 2026-04-21  
**Estimate:** 8 phases, each independently shippable

Each task lists: what to build, files to touch, and the done condition.

---

## Phase 1 — Foundation

Goal: harden the auth gate, add the `is_admin` column, and confirm the base layout is production-ready before any new capabilities are added.

### 1.1 Add `is_admin` column to users table
- **What:** Create a new migration that adds `is_admin INTEGER NOT NULL DEFAULT 0` to `users`, sets `michaelamarino16@gmail.com` to `is_admin = 1`
- **Files:** `backend/migrations/` (new migration file)
- **Done:** Migration runs without error; `SELECT is_admin FROM users WHERE email = 'michaelamarino16@gmail.com'` returns `1`

### 1.2 Update `requireAdmin` to use `is_admin` column
- **What:** Replace the hardcoded email string check in `requireAdmin` with `user.is_admin !== 1`; update the `User` type to include `is_admin: number`
- **Files:** `backend/src/routes/admin.ts`, `backend/src/types.ts`, `backend/src/lib/auth.ts` (ensure `is_admin` is selected in session queries)
- **Done:** A non-admin authenticated user receives 403 on any `/api/admin/*` call; the admin user receives the expected response

### 1.3 Add `system_events` table for scheduled job tracking
- **What:** Migration adding `system_events (id, event_type TEXT, ran_at DATETIME DEFAULT CURRENT_TIMESTAMP)`; update `scheduled()` handler to insert a row on every invocation
- **Files:** `backend/migrations/` (new migration), `backend/src/index.ts`
- **Done:** After a cron fires (or `wrangler dev --test-scheduled`), a row exists in `system_events`

### 1.4 Verify frontend route guard matches backend gate
- **What:** Confirm `AdminPage.tsx` redirects non-admin users using the `is_admin` field from `/api/me` rather than hardcoded email; update if needed
- **Files:** `frontend/src/pages/AdminPage.tsx`
- **Done:** A non-admin logged-in user navigating to `/admin` is redirected to `/`; the admin user sees the dashboard

---

## Phase 2 — Capability 1 Completion (User List Pagination)

Goal: the existing user list handles large user counts without loading everything into memory.

### 2.1 Add server-side pagination to `GET /api/admin/users`
- **What:** Add `?page=1&limit=100` query params to the handler; add `LIMIT ? OFFSET ?` to the D1 query; return `{ data, total, page, limit }` envelope
- **Files:** `backend/src/routes/admin.ts` (`handleAdminUsers`)
- **Done:** `GET /api/admin/users?page=2&limit=100` returns the second 100 users; `total` reflects the full count

### 2.2 Add pagination controls to CRM and Users tabs
- **What:** Add prev/next buttons and current page indicator to both tabs; client-side search filters within the current page only
- **Files:** `frontend/src/pages/AdminPage.tsx` (`CRMTab`, `UsersTab`)
- **Done:** Navigating to page 2 fetches `/api/admin/users?page=2`; search box filters visible rows without a network call

### 2.3 Fix cancelled subscription display
- **What:** Add a "Cancelled" badge for users with `status = 'cancelled'` instead of showing "Free"
- **Files:** `frontend/src/pages/AdminPage.tsx` (`CRMTab`, `getPlanLabel`)
- **Done:** A user with `plan = 'monthly'` and `status = 'cancelled'` shows "Pro Monthly — Cancelled" not "Free"

---

## Phase 3 — Capability 2 (Collection Drill-Down)

Goal: admin can click any user and browse their complete collection.

### 3.1 Add `GET /api/admin/users/:userId/collection` endpoint
- **What:** New handler returning paginated `collection_items` joined with `cards` for the given `userId`; validates `userId` is a positive integer; returns 404 if user not found; page size 50
- **Files:** `backend/src/routes/admin.ts`, `backend/src/index.ts` (new route registration)
- **Done:** `GET /api/admin/users/1/collection?page=1` returns up to 50 items with card metadata; `GET /api/admin/users/99999/collection` returns 404

### 3.2 Add R2 image proxy endpoint for admin thumbnails
- **What:** `GET /api/admin/image?key=<r2key>` — validates admin session, fetches the R2 object, streams bytes with correct `Content-Type`; rejects keys that contain `..` or don't match `user-\d+/` prefix
- **Files:** `backend/src/routes/admin.ts`, `backend/src/index.ts`
- **Done:** A valid R2 key returns the image bytes with `Content-Type: image/jpeg` (or appropriate type); an invalid key returns 400; a non-admin session returns 403

### 3.3 Build collection drill-down panel in `AdminPage.tsx`
- **What:** Clicking a user row opens a slide-over panel showing their collection; items paginated with prev/next; thumbnail images loaded via `/api/admin/image?key=`; unidentified items show "Unidentified" badge; clicking an item opens the edit sheet (Phase 5)
- **Files:** `frontend/src/pages/AdminPage.tsx` (new `CollectionPanel` component)
- **Done:** Admin can click a user, see their items paginated, and see thumbnails load via the proxy endpoint; zero-item collections show empty state

---

## Phase 4 — Capability 3 (Scan Logs + Pending Identifications)

Goal: admin can review low-confidence AI scans and discard bad identification records.

### 4.1 Add `GET /api/admin/scans` endpoint
- **What:** Handler returning paginated `pending_identifications` joined with `collection_items` and `users` (for email); supports `?status=pending|confirmed|all&page=1`; default sort `confidence_score ASC`; page size 50
- **Files:** `backend/src/routes/admin.ts`, `backend/src/index.ts`
- **Done:** `GET /api/admin/scans?status=pending` returns only unconfirmed records ordered by confidence ascending; `?status=all` returns both

### 4.2 Add `DELETE /api/admin/scans/:pendingId` endpoint
- **What:** Deletes the `pending_identifications` row by ID; does not touch `collection_items`; returns 404 if ID not found; returns the deleted record's `collection_item_id` in the response
- **Files:** `backend/src/routes/admin.ts`, `backend/src/index.ts`
- **Done:** Deleting a valid pending ID removes the row; the linked collection item's `card_id` is unchanged; deleting a non-existent ID returns 404

### 4.3 Build Scans tab in `AdminPage.tsx`
- **What:** New `ScansTab` component; status filter toggle (Pending / Confirmed / All); table showing item ID, user email, confidence score (colour-coded: red < 20, amber < 50), confirmation status, created date; "Discard" button with confirmation dialog; "View Item" links to the edit panel (Phase 5)
- **Files:** `frontend/src/pages/AdminPage.tsx`, update `TABS` array and tab rendering
- **Done:** Default view shows lowest-confidence pending records first; Discard removes the row from the list; colour coding matches spec thresholds

---

## Phase 5 — Capability 4 (ID Override + Edit Panel)

Goal: admin can correct any field on any collection item or shared card, regardless of which user owns it.

### 5.1 Add `PATCH /api/admin/collection/:itemId` endpoint
- **What:** Updates allowed fields on `collection_items` (`condition_note`, `estimated_grade`, `estimated_value_cents`, `card_id`); explicitly excludes `user_id`, `front_image_url`, `back_image_url` from the update set; marks `pending_identifications` confirmed when `card_id` is set; returns full updated row
- **Files:** `backend/src/routes/admin.ts`, `backend/src/index.ts`
- **Done:** PATCH with `{ "estimated_grade": "PSA 9" }` updates the row; PATCH with `{ "user_id": 2 }` is silently ignored (field stripped); PATCH with a non-existent `card_id` returns 400

### 5.2 Add `PATCH /api/admin/cards/:cardId` endpoint
- **What:** Updates `cards` fields (`card_name`, `set_name`, `game`, `card_number`, `rarity`, `image_url`, `external_ref`); returns collection impact count in response (`{ updated: true, affected_collections: N }`)
- **Files:** `backend/src/routes/admin.ts`, `backend/src/index.ts`
- **Done:** PATCH with `{ "card_name": "Charizard EX" }` updates the shared card row and returns `affected_collections: N`; empty `card_name` returns 400

### 5.3 Build item edit sheet in `AdminPage.tsx`
- **What:** Slide-over sheet opened from the collection panel (Phase 3) or Scans tab (Phase 4); fields for all editable `collection_items` columns; separate "Edit shared card" section that shows the impact warning before saving; "Reassign to different card" input with catalog search; save calls the appropriate PATCH endpoint
- **Files:** `frontend/src/pages/AdminPage.tsx` (new `ItemEditSheet` component)
- **Done:** Saving an item update shows a success toast and updates the row in the parent list; editing a shared card shows "This card is in N collections" warning before the PATCH fires; empty `card_name` shows inline error

---

## Phase 6 — Capability 6 (Batch Delete + Reassign)

Goal: admin can select multiple items and delete or reassign them in one operation.

### 6.1 Add `POST /api/admin/collection/batch-delete` endpoint
- **What:** Accepts `{ itemIds: number[] }`; validates array is non-empty, all elements are positive integers, max 500; deletes D1 rows using `D1.batch()`; deletes R2 objects for each item's `front_image_url` and `back_image_url` (best-effort, log failures); returns `{ deleted: N, skipped: number[] }`
- **Files:** `backend/src/routes/admin.ts`, `backend/src/index.ts`
- **Done:** POST with 3 valid IDs deletes all 3 rows and their R2 keys; an invalid ID in the array is skipped and listed in `skipped`; array of 501 IDs returns 400

### 6.2 Add `POST /api/admin/collection/batch-reassign` endpoint
- **What:** Accepts `{ itemIds: number[], cardId: number }`; validates `cardId` exists in `cards`; updates `card_id` for all valid item IDs using `D1.batch()`; marks `pending_identifications` confirmed for those items; returns `{ reassigned: N, skipped: number[] }`
- **Files:** `backend/src/routes/admin.ts`, `backend/src/index.ts`
- **Done:** POST with 5 item IDs and a valid `cardId` updates all 5 rows; a non-existent `cardId` returns 400 "Card not found" before any update executes

### 6.3 Add checkbox selection and batch action toolbar to collection panel
- **What:** Add a checkbox column to the collection panel table (Phase 3); a sticky toolbar appears when ≥1 item is selected showing item count, "Delete Selected" and "Reassign Selected" buttons; each action shows a confirmation dialog; on success the panel refreshes and selection is cleared
- **Files:** `frontend/src/pages/AdminPage.tsx` (`CollectionPanel`)
- **Done:** Selecting 3 items and clicking "Delete Selected" shows a confirmation, calls batch-delete, shows "3 items deleted" toast, and removes the rows from the table

---

## Phase 7 — Capability 5 (System Health)

Goal: admin has a single view showing D1 table sizes, R2 usage, last cron run, and rate-limit activity.

### 7.1 Add `GET /api/admin/health` endpoint
- **What:** Runs a `D1.batch()` of `COUNT(*)` queries for every table; optionally calls Cloudflare API for R2 usage if `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set; queries `system_events` for last scheduled run; queries `rate_limits` for last-hour hit count; all sub-calls are independent — a single failure does not 500 the whole response
- **Files:** `backend/src/routes/admin.ts`, `backend/src/index.ts`, `backend/wrangler.toml` (add `CLOUDFLARE_ACCOUNT_ID` var), `backend/src/types.ts` (add `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` to `Env`)
- **Done:** `GET /api/admin/health` returns table row counts for all tables; without `CLOUDFLARE_API_TOKEN` the R2 fields read "Not configured"; with a valid token R2 object count and bytes are populated

### 7.2 Store `CLOUDFLARE_API_TOKEN` as a Wrangler secret
- **What:** Document the `wrangler secret put CLOUDFLARE_API_TOKEN` step in `backend/README.md`; add `CLOUDFLARE_ACCOUNT_ID` to `[vars]` in `wrangler.toml`
- **Files:** `backend/wrangler.toml`, `backend/README.md`
- **Done:** `wrangler.toml` contains `CLOUDFLARE_ACCOUNT_ID`; no token value appears in any tracked file

### 7.3 Build Health tab in `AdminPage.tsx`
- **What:** New `HealthTab` component; grid of D1 table row counts; R2 section showing object count and storage bytes (or "Not configured"); "Last job run" timestamp; rate-limit hits counter (amber highlight > 500); manual refresh button
- **Files:** `frontend/src/pages/AdminPage.tsx`, update `TABS` array
- **Done:** Health tab loads and shows all D1 table counts; rate-limit counter turns amber when value exceeds 500; refresh button re-fetches the endpoint

---

## Phase 8 — Capability 7 (Catalog CRUD UI + Admin-Only Guard)

Goal: admin can manually create, edit, and delete cards and releases from the UI; catalog write endpoints are restricted to admin only.

### 8.1 Add `requireAdmin` to catalog write endpoints
- **What:** Add `requireAdmin` check (using `is_admin` from Phase 1.2) to `createCard`, `updateCard`, `deleteCard` in `backend/src/routes/cards.ts` and `createRelease` in `backend/src/routes/releases.ts`
- **Files:** `backend/src/routes/cards.ts`, `backend/src/routes/releases.ts`
- **Done:** An authenticated non-admin user calling `POST /api/cards` receives 403; the admin user can create cards normally

### 8.2 Add catalog card CRUD UI to Catalog tab
- **What:** Add a searchable card list section above the seed panel; "New Card" button opens a form modal; each row has "Edit" and "Delete" actions; delete shows usage warning if `collection_count > 0`; form calls `POST /api/cards` or `PATCH /api/cards/:id`; delete calls `DELETE /api/cards/:id`
- **Files:** `frontend/src/pages/AdminPage.tsx` (`CatalogTab`, new `CardFormModal` component)
- **Done:** Admin can create a card, see it appear in the list, edit it, and delete it; deleting a card referenced by collections shows the warning modal with the correct count before proceeding

### 8.3 Add releases CRUD section to Catalog tab
- **What:** Add a releases table below the card catalog section; "New Release" button opens a form; fields: `game`, `release_name`, `product_type`, `release_date` (date picker enforcing YYYY-MM-DD), `source_url`; edit and delete per row; form calls `POST /api/releases` or `PATCH /api/releases/:id` (PATCH endpoint does not yet exist — add it to `releases.ts`)
- **Files:** `backend/src/routes/releases.ts` (add `updateRelease`), `backend/src/index.ts` (register `PATCH /api/releases/:id`), `frontend/src/pages/AdminPage.tsx`
- **Done:** Admin can create a release with a valid date; an invalid date format shows the inline error "Invalid date format. Use YYYY-MM-DD"; editing and deleting releases works end-to-end

---

## Dependency Order

```
Phase 1 (foundation)
  └── Phase 2 (can ship independently after 1.1–1.2)
  └── Phase 3
        └── Phase 4 (edit sheet links from Phase 3 panel)
              └── Phase 6 (batch actions live in Phase 3 panel)
  └── Phase 5 (depends on 1.3 for system_events)
  └── Phase 8 (depends on 1.2 for requireAdmin)
```

Phases 2, 5, and 8 have no dependency on each other and can be built in parallel after Phase 1 completes.

---

## Open Items Not in This Plan

- Migrate `ADMIN_EMAIL` constant from `AdminPage.tsx` to derive from `user.is_admin` (done in Phase 1.4 but the constant itself can be removed once Phase 1.2 is live)
- SQL Runner read-only binding (Cloudflare does not yet support read-only D1 bindings — revisit when available)
- R2 signed URL support — if Cloudflare adds pre-signed R2 URLs for Workers, replace the proxy endpoint (Phase 3.2) with signed URLs
