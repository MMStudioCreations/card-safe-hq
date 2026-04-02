# Card Safe HQ — Project Memory

## Project Identity
Card Safe HQ is a production SaaS application for sports/trading card collection management.
Stack: Cloudflare Pages + Workers + D1 (SQLite) + R2 | React 19 / Vite / Tailwind | Claude Vision API | eBay comps API.
Domain candidate: cardsafehq.com

## Core Directive: Security-First
**Before writing any function, think like an attacker.**
Every session, assume an adversary is probing every endpoint, input field, and auth flow.
If a security tradeoff exists, surface it explicitly — never silently implement an insecure pattern.

## Stack Conventions
- Package manager: `npm` (not pnpm, not yarn)
- Framework: React 19 with hooks — no class components
- Styling: Tailwind utility classes only — no inline styles
- DB: Cloudflare D1 (SQLite) — always parameterized queries, never string interpolation
- Storage: Cloudflare R2 — never expose bucket URLs directly; proxy through Workers
- Auth tokens: httpOnly cookies only — never localStorage or sessionStorage
- API routes: Cloudflare Workers — enforce auth middleware on every protected route

## Commands
- Dev: `npm run dev`
- Build: `npm run build`
- Type check: `npm run typecheck`
- Test: `npm run test`
- Deploy: `wrangler deploy`

## Architecture Rules
- Monorepo structure: `apps/web` (frontend), `apps/api` (Workers), `packages/shared` (types/utils)
- Row-level ownership: every DB query that touches user data MUST include `WHERE user_id = ?`
- No open endpoints by default — protected unless explicitly marked public
- Error responses: generic messages to client, detailed logs internally only
- All user inputs validated server-side — client validation is UX only, not security

## What NOT to Do
- Never use `eval()`, `innerHTML`, or unescaped template literals with user data
- Never log emails, tokens, card values, or PII in plain text
- Never return stack traces or DB errors to the client
- Never commit `.dev.vars`, `.env`, or any secrets file
- Never trust `Content-Type` without validation on POST/PUT routes

## Reference Files
Security rules: `.claude/rules/security.md`
Auth rules: `.claude/rules/auth.md`
Data layer rules: `.claude/rules/data.md`
