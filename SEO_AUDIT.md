# SEO / AEO Audit: cardsafehq.com

Date: 2026-10-05. Method: read-only `curl` of the live site with browser, search-bot and AI-bot user agents, plus a review of this repo.

## What is actually live

- **cardsafehq.com does not serve the React app in `frontend/src`.** It serves a static link-in-bio page: a logo, the tagline "Graded singles · Sealed · Restoration", and links to the eBay store, Whatnot, Instagram, TikTok and Staten News.
- That page comes from `origin/main` (commits `b377029`..`92177db`: `links/index.html` + `frontend/scripts/build-landing.mjs`, "Replace SaaS frontend with link-landing homepage"). This `seo-aeo` branch is based on `origin/main` (`92177db`), so it changes the page that is live.
- Hosting: Cloudflare Pages (`card-safe-hq` project) behind the Cloudflare proxy. API: Cloudflare Worker `cardsafehq-api`.
- SPA vs SSR: not an issue now. The live page is a single static HTML file, so **prerendering/SSG is not needed**. The React SPA (client-rendered, empty `<div id="root">`) is retired.

## Findings, ranked by impact

### 1. Critical: Cloudflare bot protection blocks automated clients (likely including AI crawlers)

| User agent | Status |
|---|---|
| Chrome desktop UA | 200 |
| `curl/8.0`, plain `Mozilla/5.0` | 403 "Just a moment..." managed challenge (`cf-mitigated: challenge`, `noindex,nofollow`) |
| Googlebot, Bingbot UA | First request 200, later requests 403 |
| GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot UA | 403 |

Spoofed user agents aren't "verified bots", so this doesn't prove that the real Googlebot or GPTBot gets blocked. Still, the page carries Cloudflare's JS-detection script and challenges automated traffic. Since July 2025, Cloudflare blocks AI crawlers on new zones by default ("Block AI bots" / AI Crawl Control). If that setting is on, ChatGPT, Claude and Perplexity cannot read the site at all, and no on-page fix will matter.

**Michael (dashboard, not code):** in Cloudflare, open cardsafehq.com > Security > Bots and AI Crawl Control:
- Turn off "Block AI bots" (or allow at least OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User).
- Make sure Bot Fight Mode / any WAF rule doesn't challenge verified bots.
- Leave "Managed robots.txt" off so the repo's robots.txt is used.
- Then confirm in Google Search Console (URL Inspection > Test live URL) and Bing Webmaster Tools.

### 2. High: page content and links are injected by JavaScript

In `links/index.html`, the link list is built with `innerHTML` from a JS `CONFIG` object, and so is the show line. Without JavaScript, a crawler sees only the logo alt text "Card Safe HQ" and the tagline: no links to eBay, Whatnot or the socials, no H1 and no descriptive text. Google renders JS later, but most AI crawlers (GPTBot, ClaudeBot, PerplexityBot) do not execute JavaScript.

**Fix:** write the five links as plain `<a href>` HTML in the page. This keeps the same classes, so the design doesn't change. See the spec below.

### 3. High: robots.txt, sitemap.xml, llms.txt are missing, and every URL returns 200

`frontend/public/_redirects` ends in `/* /index.html 200`, a leftover from the SPA. As a result:
- `/robots.txt`, `/sitemap.xml` and `/llms.txt` return the HTML page with status 200, so robots.txt is invalid and the sitemap is unreadable.
- Any made-up URL (for example `/xyz`) returns 200 with the homepage, a "soft 404". Old SaaS URLs that Google may have indexed (`/protection`, `/builder`, `/login`, ...) all duplicate the homepage.

**Fix:**
- Add the robots.txt, sitemap.xml and llms.txt files (done on this branch, in `frontend/public/`).
- On `origin/main`, add these three files to the `assetsToCopy` list in `frontend/scripts/build-landing.mjs`. That build only copies whitelisted files, so without this step they won't deploy.
- Replace the catch-all with `301` redirects for the old SaaS routes to `/`, and add a real `404.html`.

### 4. High: no structured data, thin meta tags

The live `<head>` has title "Card Safe HQ", a description, `og:title/description/url`, and a canonical. It's missing:
- A descriptive `<title>`, for example "Card Safe HQ | Graded Cards, Sealed Product & Live Breaks".
- `og:type`, `og:image`, all Twitter card tags, and `<meta name="robots">`.
- **JSON-LD.** An `Organization` with `sameAs` pointing to the eBay store, Whatnot, Instagram and TikTok is the single strongest signal for AI assistants that these profiles are one business. Add `WebSite` too, and `FAQPage` once an FAQ exists.

### 5. Medium: no text explaining what Card Safe HQ is

There's no H1 and no paragraph saying who sells what, where it ships, or which games or sports it covers. AI answers quote text. They can't quote a list of buttons.

**Fix:** add a visible `<h1>`, a 2-3 sentence "About" section and a short FAQ. Details marked [PLACEHOLDER] must come from Michael.

### 6. Medium: brand description is inconsistent

- Live tagline: "Graded singles · Sealed · Restoration".
- README on `origin/main`: "Acrylic display cases, card sleeves, and sealed product storage".
- `frontend/index.html` (old SPA): "Silicone slab guards in 61 colors".

Pick one description and use it on the site, the eBay store "About" page, and the Instagram, TikTok and Whatnot bios. Entity consistency is what makes assistants confident enough to recommend a business.

### 7. Low-medium: performance

- `logo.png` is about 855 KB (1568x523) and is the page's largest image.
- **Fix:** export a WebP or AVIF version (under about 80 KB), and add `fetchpriority="high"`.
- **Fix:** the page loads two Google Fonts. Consider `font-display` plus fewer weights.

### 8. Low: www subdomain doesn't resolve

`https://www.cardsafehq.com` fails DNS. **Michael (DNS):** add a proxied `www` record with a 301 redirect to the apex.

### 9. Repo hygiene

- `README.md` and `CLAUDE.md` on local `main` still describe the retired SaaS.
- The SPA `frontend/index.html` meta (slab guards, deck builder) is stale. It doesn't affect the live site.

## Off-site work (biggest AEO lever after #1)

AI assistants recommend businesses that other sites mention.
- Make the eBay store "About" page and every social bio link to cardsafehq.com and use the same one-line description.
- Get mentioned or linked from Staten News TCG articles, Reddit and Discord communities, and break or collector directories.
- Collect eBay feedback. It is often quoted in answers.

## Status (branch `seo-aeo`, local commits only, not deployed)

### Done in code

- **Static content (fixes 2 and 5):**
  - `links/index.html` now ships its five link cards (eBay, Whatnot, Instagram, TikTok, Staten News) and the show line as plain HTML. The cards use the same classes, icons, `utm_source` tracking and design as before. The page has no JavaScript left except the JSON-LD.
  - The logo is now the page's `<h1>`.
  - Added an About section and a 5-question FAQ (collapsible `<details>`) in the page's existing style.
- **Head (fix 4):**
  - Descriptive `<title>` and meta description.
  - `robots` meta and trailing-slash canonical.
  - Full Open Graph and Twitter card tags, using `logo.png` as the image.
  - JSON-LD: `Organization` (with `sameAs` for eBay, Whatnot, Instagram and TikTok), `WebSite`, and a `FAQPage` holding only the two fully factual Q&As.
- **Crawler files and routing (fix 3):**
  - `frontend/public/robots.txt`, `sitemap.xml` and `llms.txt` added.
  - `frontend/scripts/build-landing.mjs` now copies them, plus `logo.webp` and `404.html`. The build fails if any of them is missing.
  - `frontend/public/_redirects` no longer has the `/* /index.html 200` catch-all. The retired SaaS routes now return a `301` to `/`.
  - Unknown paths are served `404.html` (noindex) with a real 404 status. That is Cloudflare Pages' default once a `404.html` exists.
- **Performance (fix 7):** new `logo.webp` (1080x360, about 72 KB, versus 855 KB for the PNG) is preloaded and used on the page. `logo.png` is kept for social previews.

**Verified:**
- `npm run build --workspace=frontend` produces `dist/` with `index.html`, `links/index.html`, `404.html`, `robots.txt`, `sitemap.xml`, `llms.txt` and `logo.webp`.
- The built HTML contains the `<h1>`, all 5 links, and parseable JSON-LD.
- A headless-browser screenshot matches the old page above the new About/FAQ section.
- Wrangler parsed `_redirects` without errors, but I couldn't run its local server (a pre-existing esbuild target error). Check routing on a Pages preview deploy before going live.

### Michael must do

1. **Cloudflare bot settings (fix 1).** This decides whether AI assistants can read the site at all. Settings are listed under finding 1.
2. **Fill every `[PLACEHOLDER]`** in `links/index.html` (About text, 4 FAQ answers) and `frontend/public/llms.txt`, or delete those lines. They are visible to visitors, so don't deploy them unfilled. Once an answer is real, add it to the `FAQPage` JSON-LD as well.
3. **Pick one brand description (fix 6)** and use it in the eBay "About" page and all social bios.
4. **Optional:** a 1200x630 `og-image.png` for nicer link previews (then update `og:image` / `twitter:image`).
5. **DNS:** add `www` (fix 8).
6. **Merge and deploy.** Pushing to `main` triggers `.github/workflows/deploy.yml`. Then submit `https://cardsafehq.com/sitemap.xml` in Google Search Console and Bing Webmaster Tools, and run URL Inspection.
