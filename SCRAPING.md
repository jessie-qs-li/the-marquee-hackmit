## Where the listings come from

`scripts/scrape.mjs` fetches this week's showtimes from the cinemas' own sites and writes
`data/screenings.json`, which `index.html` loads at startup. Scraping runs in Node, not in the
page: the cinemas send no CORS headers, so a browser cannot read their pages directly.

```bash
node scripts/scrape.mjs                   # NYC, next 7 days
node scripts/scrape.mjs --city boston     # Greater Boston
node scripts/scrape.mjs --days 14
node scripts/scrape.mjs --only ff,mg      # one or more venue ids
```

Each city writes its own file — `data/screenings.json` and
`data/screenings-boston.json` — and the page loads one at a time, so venues and
screenings from the two never mix. Both need to be refreshed to stay current.
The page fetches its schedule at startup; if that fetch fails it says the
listings could not be loaded rather than showing stale or invented data.

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


## Running the refresh from your own machine

Cinema Village refuses GitHub's shared runner addresses, so every scheduled run
loses roughly eighty showtimes with `HTTP 403 on GET /showtimes/`. It answers a
normal residential address without complaint, so the fix is to run the job from
one:

```bash
bash scripts/setup-runner.sh <REGISTRATION_TOKEN>
```

The token comes from **Settings → Actions → Runners → New self-hosted runner**
and lasts an hour. The script installs the runner as a login service, so it
survives reboots. Afterwards add a repository **variable** (not a secret):

| Variable | Value |
| --- | --- |
| `RUNNER_LABEL` | `marquee-local` |

The workflow reads `${{ vars.RUNNER_LABEL || 'ubuntu-latest' }}`, so until that
variable exists it keeps using GitHub's runners and nothing breaks while the
runner is being set up.

The trade-off: a runner on a laptop only works while the laptop is awake. A
missed slot is not a gap in the listings -- the published schedule simply stays
as it was until the next successful run -- but it does mean the three-hourly
cadence becomes best-effort. Somewhere always-on avoids that.

## Staying current

`.github/workflows/refresh-listings.yml` re-scrapes both cities every three
hours, commits the result and redeploys. It also runs on demand from the Actions tab.

Two things keep it safe to leave alone:

- `scripts/check-refresh.mjs` runs between scraping and publishing. It refuses
  to publish a schedule with no screenings, or one that has lost more than half
  its screenings or live venues since the last commit — a network blip or a new
  bot wall leaves the published board untouched rather than emptying it.
- It also reports whether anything actually changed, ignoring the `fetchedAt`
  stamp, so a quiet hour makes no commit and no deployment.

The workflow needs three repository secrets:

| Secret | Where it comes from |
| --- | --- |
| `VERCEL_TOKEN` | vercel.com/account/tokens |
| `VERCEL_ORG_ID` | the `orgId` in `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | the `projectId` in `.vercel/project.json` |

`.vercel/` is gitignored, so those two ids exist only on the machine that ran
`vercel deploy`.

The header chip shows how stale the listings are — "updated 12 min ago" — so a
job that has quietly stopped is visible on the site itself.

## Cities and genres

`node scripts/scrape.mjs` refreshes NYC; `node scripts/scrape.mjs --city boston`
refreshes Greater Boston. Everything the page does — the borough/area filter, the
cinema multi-select, the time range, genres, quiet-venue notices, Find a Pick —
runs off whichever city's file is loaded.

Greater Boston lists six cinemas, four of them live:

| Cinema | Source | Showtimes in the last run |
| --- | --- | --- |
| Brattle Theatre | HTML — per-day schedule | 20 |
| Coolidge Corner Theatre | HTML — per-day showtimes page | 112 |
| Landmark Kendall Square Cinema | JSON — Landmark Box Office API | 70 |
| Harvard Film Archive | HTML — calendar with machine datetimes | 5 |

| Not yet scraped | Why |
| --- | --- |
| Somerville Theatre | somervilletheatre.com returns 403 to scripted requests; the page loads normally in a real browser, so this needs a headless browser. |
| Museum of Fine Arts | The programs calendar lists only a couple of film entries and carries date ranges rather than showtimes; per-screening times are not in any page found. |

Boston venues are listed by town — Boston, Cambridge, Brookline, Somerville —
where New York is listed by borough.

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

## NYC theater map

The This Week map uses locally bundled Leaflet 1.9.4 and CARTO Voyager raster
tiles. The public basemap key is in `assets/theater-map.js`; it is intended for
browser tile requests, unlike the private TMDB credential. CARTO allows domain
restrictions via its basemap dashboard. Attribution remains visible on the map.

`assets/theater-locations.js` stores coordinates for the 20 NYC venues, with
OpenStreetMap source URLs. These were geocoded once and cached; no geocoding API
is called by visitors. Check coordinates when a venue relocates. The map honors
borough and cinema filters; red pins have screenings matching the chosen day,
time and content filters. Boston does not display a map yet. Show map defaults
on and its selection persists while switching filters and cities in the page.
