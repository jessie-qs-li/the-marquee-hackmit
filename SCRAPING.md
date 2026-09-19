## Where the listings come from

`scripts/scrape.mjs` fetches this week's showtimes from the cinemas' own sites and writes
`data/screenings.json`, which `index.html` loads at startup. Scraping runs in Node, not in the
page: the cinemas send no CORS headers, so a browser cannot read their pages directly.

```bash
node scripts/scrape.mjs              # next 7 days
node scripts/scrape.mjs --days 14
node scripts/scrape.mjs --only ff,mg # one or more venue ids
```

Open `index.html` without running the scraper and it falls back to the seeded sample week,
and says so in the header.

### Live adapters (9 of 20 venues)

| Cinema | Source | Notes |
| --- | --- | --- |
| Film Forum | HTML — weekly tab grid | bare clock times resolved by cinema convention |
| Metrograph | HTML — dated calendar blocks | also yields director, year, runtime and format |
| IFC Center | HTML — daily-schedule blocks |  |
| Anthology Film Archives | HTML — month calendar table |  |
| Quad Cinema | HTML — per-day listing blocks |  |
| Nitehawk Williamsburg | HTML — per-day page, unix timestamps |  |
| Nitehawk Prospect Park | HTML — per-day page, unix timestamps |  |
| Maysles Documentary Center | JSON — Squarespace `?format=json` | small programme; a few events a week |
| UnionDocs | JSON — The Events Calendar REST | nothing scheduled in the current week |

### Listed but not yet scraped (11 venues)

These are on the board and in the filters, but have no adapter yet. The run report prints
the reason for each rather than quietly returning nothing.

| Cinema | Why |
| --- | --- |
| Cinema Village | Showtimes are injected client-side; the served HTML has no times. |
| Roxy Cinema New York | Squarespace site renders its schedule in JS; no showtimes in the HTML. |
| Angelika Film Center | Single-page app; listings come from an authenticated internal API. |
| The Paris Theater | Schedule is rendered client-side; served HTML carries no showtimes. |
| Walter Reade Theater | filmlinc.org returns 403 to scripted requests (bot protection). |
| Elinor Bunin Munroe Film Center | filmlinc.org returns 403 to scripted requests (bot protection). |
| BAM Rose Cinemas | Listings load from a JSON API behind the page; no stable public endpoint found. |
| Spectacle | Calendar is a JS widget; the served HTML lists no showtimes. |
| Syndicated | No listings path found that returns showtimes in HTML. |
| Museum of the Moving Image | movingimage.org returns 403 to scripted requests (bot protection). |
| Kew Gardens Cinema | Host does not respond to requests from here (connection times out). |

The three causes, and what each would take:

- **Client-rendered schedules** (Cinema Village, Roxy, Paris, Spectacle, Angelika) — the served
  HTML has no showtimes. Needs a headless browser, or the internal JSON endpoint each app calls.
- **Bot protection** (Film at Lincoln Center, MOMI) — both return 403 to scripted requests.
  Needs a real browser session, or asking the venues for a feed.
- **Unreachable / not found** (Kew Gardens, Syndicated, BAM) — no listings path that returns
  showtimes; BAM loads them from an API with no stable public route.

### Known limitation

Scraping yields titles and showtimes, not taste data. Films that match the curated catalogue in
`index.html` inherit their tags and ratings; everything else arrives untagged, and **Find a Pick
only ranks films it holds taste data for** — it reports its coverage rather than guessing. Closing
that gap means enriching scraped titles from a film metadata source (TMDB, Letterboxd), which is
the next build.

These are HTML scrapers against sites that can redesign without notice. Every adapter treats a
zero-row parse as a failure, so a silent break shows up in the run report.

