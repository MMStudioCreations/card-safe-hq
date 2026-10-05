# SEO / AEO Audit: cardsafehq.com

Date: 2026-10-05. Method: read-only `curl` of the live site with browser, search-bot and AI-bot user agents, plus a review of this repo.

## What is actually live

- **cardsafehq.com does not serve the React app in `frontend/src`.** It serves a static link-in-bio page: a logo, the tagline "Graded singles · Sealed · Restoration", and links to the eBay store, Whatnot, Instagram, TikTok and Staten News.
- That page comes from `origin/main` (commits `b377029`..`92177db`: `links/index.html` + `frontend/scripts/build-landing.mjs`, "Replace SaaS frontend with link-landing homepage"). **Local `main` is 5 commits behind `origin/main`**, and this `seo-aeo` branch was cut from local `main`.
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

## Spec: landing-page changes (`links/index.html` on origin/main)

These could not be committed here: this branch was cut from the stale local `main`, which doesn't contain `links/index.html`. Apply them after this branch is rebased onto `origin/main`.

1. `<head>`:
   ```html
   <title>Card Safe HQ | Graded Cards, Sealed Product & Live Breaks</title>
   <meta name="description" content="Card Safe HQ sells graded singles, raw singles and sealed trading card product on eBay, runs live breaks on Whatnot, and shares pickups and restorations on Instagram and TikTok.">
   <meta name="robots" content="index,follow,max-image-preview:large">
   <link rel="canonical" href="https://cardsafehq.com/">
   <meta property="og:type" content="website">
   <meta property="og:image" content="https://cardsafehq.com/logo.png"> <!-- better: a 1200x630 og-image.png [PLACEHOLDER] -->
   <meta name="twitter:card" content="summary_large_image">
   <meta name="twitter:title" content="Card Safe HQ">
   <meta name="twitter:description" content="Graded singles, sealed product and live breaks.">
   <meta name="twitter:image" content="https://cardsafehq.com/logo.png">
   ```
2. JSON-LD:
   ```html
   <script type="application/ld+json">
   {"@context":"https://schema.org","@graph":[
    {"@type":"Organization","@id":"https://cardsafehq.com/#org","name":"Card Safe HQ",
     "alternateName":["CardSafe HQ","cardsafehq"],"url":"https://cardsafehq.com/",
     "logo":"https://cardsafehq.com/logo.png",
     "description":"Online seller of graded singles, raw singles and sealed trading card product, with live breaks on Whatnot.",
     "sameAs":["https://www.ebay.com/str/cardsafehq","https://www.whatnot.com/user/cardsafehq",
               "https://www.instagram.com/cardsafe.hq","https://www.tiktok.com/@cardsafe.hq"]},
    {"@type":"WebSite","@id":"https://cardsafehq.com/#site","url":"https://cardsafehq.com/",
     "name":"Card Safe HQ","publisher":{"@id":"https://cardsafehq.com/#org"}}
   ]}
   </script>
   ```
   Add a `FAQPage` node with the same Q&A text as the visible FAQ once the placeholders below are filled. Don't publish FAQ schema that contains placeholders.
3. Body:
   - Wrap the logo in `<h1>` (`<h1 class="mark"><img src="/logo.png" alt="Card Safe HQ" ...></h1>`).
   - Replace the JS-rendered `<ul id="links">` with static `<li><a class="card" href="https://www.ebay.com/str/cardsafehq?utm_source=cardsafehq.com" target="_blank" rel="noopener">...` items. Keep the `CONFIG` only as a comment, or delete the script.
   - Write the show line as static text.
4. About and FAQ below the links, in the same visual style:
   - About: "Card Safe HQ is an online trading card shop selling graded singles, raw singles and sealed product on eBay, with live breaks and auctions on Whatnot. [PLACEHOLDER: games/sports covered, where you ship from, since when]."
   - FAQ (answers in brackets need Michael):
     - Where can I buy from Card Safe HQ? "On our eBay store (ebay.com/str/cardsafehq) and during live shows on Whatnot."
     - What do you sell? "Graded slabs, raw singles and sealed product. [PLACEHOLDER: which games/sports]."
     - Do you ship internationally? "[PLACEHOLDER]"
     - What does 'restoration' mean? "[PLACEHOLDER: describe the restoration service, or remove it]"
     - How do I contact you? "[PLACEHOLDER: email or eBay messages]"
5. `frontend/scripts/build-landing.mjs`: add `robots.txt`, `sitemap.xml`, `llms.txt` and `404.html` to `assetsToCopy`.
6. `frontend/public/_redirects`:
   - Remove `/* /index.html 200`.
   - Add `301` lines for `/protection`, `/builder`, `/membership`, `/billing`, `/search`, `/sealed`, `/trades`, `/portfolio`, `/login` and `/register` to `/`.
   - Keep `/links` (it already canonicalizes to `/`).

## Off-site work (biggest AEO lever after #1)

AI assistants recommend businesses that other sites mention.
- Make the eBay store "About" page and every social bio link to cardsafehq.com and use the same one-line description.
- Get mentioned or linked from Staten News TCG articles, Reddit and Discord communities, and break or collector directories.
- Collect eBay feedback. It is often quoted in answers.

## Done on this branch

- `frontend/public/robots.txt`: allows all crawlers, explicitly allows the AI search bots, and points to the sitemap.
- `frontend/public/sitemap.xml`: the homepage.
- `frontend/public/llms.txt`: describes the business, its storefronts and its socials. Only facts already on the live page; [PLACEHOLDER] for the rest.
- This audit.
