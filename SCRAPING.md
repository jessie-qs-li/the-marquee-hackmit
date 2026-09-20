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

### Live adapters (15 of 20 venues)

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
| Cinema Village | JSON/HTML — dated film tabs + `managemovies.html` | queries each film/date; uses session timestamps, not undated homepage times |
| Roxy Cinema New York | HTML — `.screening__card` / `.screening__date` | retains series notes and screening links |
| Angelika Film Center | JSON — Reading Cinemas public browsing API | anonymous token from `/settings/6`; NYC cinema `0000000005` only |
| The Paris Theater | JSON — Vista public browsing API | correct site: `www.paristheaternyc.com`; site `2001` only |
| BAM Rose Cinemas | JSON — `/api/BAMApi/GetCalendarEventsByDayWithOnGoing` | same date query as the film widget; excludes non-film events |
| Syndicated | HTML — Veezi sessions | uses the venue's public site token; keeps sold-out/closed notes |

### Listed but not yet scraped (5 venues)

These are on the board and in the filters, but have no adapter yet. The run report prints
the reason for each rather than quietly returning nothing.

| Cinema | Why |
| --- | --- |
| Walter Reade Theater | filmlinc.org returns 403 to scripted requests (bot protection). |
| Elinor Bunin Munroe Film Center | filmlinc.org returns 403 to scripted requests (bot protection). |
| Spectacle | Calendar is a JS widget; the served HTML lists no showtimes. |
| Museum of the Moving Image | movingimage.org returns 403 to scripted requests (bot protection). |
| Kew Gardens Cinema | Host does not respond to requests from here (connection times out). |

The earlier report incorrectly described Roxy and Paris as blocked client-rendered sites,
and missed Syndicated's public Veezi schedule. Cinema Village's homepage has undated times;
its date-specific endpoint provides the dates needed for this index. BAM and Angelika both
have public browsing APIs used by their own websites.

Paris and Angelika obtain anonymous browsing tokens at runtime. Paris's public layout script
contains the configuration used by its own browsing client; the adapter discovers that current
configuration instead of committing a password or token. Changes to this flow fail visibly in
the run report. No visitor login or saved browser session is used.

The remaining venues need separate investigation: Film at Lincoln Center and MOMI returned
403 during the original probes, Spectacle still needs a dated schedule source, and Kew Gardens
was unreachable. Those older observations have not been reverified by this change.

### Verification

```bash
node --test tests/scrapers.test.mjs
node scripts/scrape.mjs
```

The new parser tests cover title/date pairing, year rollover, midnight and timezone handling,
venue filtering, sold-out sessions, malformed responses, and metadata joins. Fetches made
through the shared helper time out after 30 seconds. The complete scrape refreshes the preview;
`--only` writes a dataset containing only the requested venues, so use a full run for the full board.

### Known limitation

Scraping yields titles and showtimes, not taste data. Films that match the curated catalogue in
`index.html` inherit their tags and ratings; everything else arrives untagged, and **Find a Pick
only ranks films it holds taste data for** — it reports its coverage rather than guessing. Closing
that gap means enriching scraped titles from a film metadata source (TMDB, Letterboxd), which is
the next build.

These are HTML scrapers against sites that can redesign without notice. Every adapter treats a
zero-row parse as a failure, so a silent break shows up in the run report.


## Cities and genres

`node scripts/scrape.mjs` refreshes NYC; `node scripts/scrape.mjs --city boston`
refreshes Greater Boston (Brattle Theatre and Coolidge Corner Theatre). Each city
has its own JSON schedule; the browser never mixes their venues or screenings.
Boston coverage is limited to those two cinemas, not all Boston cinemas.

Genre matching runs locally after scraping, using `data/movies.csv` copied from
the supplied Desktop file. The CSV is checked before a cached TMDB fallback for missing genres. Replace that
file to update the catalogue. Run `node scripts/genres.mjs` to reclassify both
saved schedules without scraping again.

Matching normalizes articles, punctuation, alternate titles, release years and
known screening suffixes. Remakes with ambiguous titles require a release year;
there is no fuzzy title matching. The supplied CSV ends in 2018, so many newer
films and special programs are absent. `genreCoverage.unresolved` in each schedule
lists titles needing review. These remain accessible under Not yet classified.
To supply verified classifications, create `data/genre-overrides.json` with keys
from that report and arrays of genres; title-only normalized keys also work.
Venue-provided genres take precedence over CSV matches; editorial overrides take
precedence over both. Each row records `genreSource` and `sourceGenres`.

The ten filter groups are Drama (including War), Comedy & Musical,
Thriller & Mystery (including Crime and Film-Noir), Horror, Sci-Fi & Fantasy,
Documentary, Action & Western, Adventure, Romance, and Animation & Family.
IMAX is a format and is not used as a genre. Films can belong to multiple groups.


### Cached TMDB enrichment

Export `TMDB_READ_TOKEN` when running `node scripts/genres.mjs` or the scraper.
On this machine, the credential is stored outside the repository and web server
root in `/Users/jessieli/Documents/Codex/.credentials/the-marquee.env` (mode 600).
Load it in the shell with `set -a`, `source <path>`, then `set +a` before running
Node. Never copy the credential into the public website directory.

`data/tmdb-cache.json` contains only public movie metadata and match statuses.
Successful matches are reused without another request. Unmatched/ambiguous searches
are retried after seven days during enrichment; visitors never call TMDB. A match
must have an exact normalized title and agree with a known release year; ambiguous
remakes are left for review. Network/authentication failures stop further API calls
for that run and are reported in `genreCoverage.errors`. CSV and cached data remain
usable without credentials. To deliberately refresh a film, remove its cache entry.
