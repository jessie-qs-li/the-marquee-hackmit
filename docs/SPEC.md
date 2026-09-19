# The Marquee — build spec

Condensed from the working spec. Covers the data model, the engine, and what was
deliberately left out.

## Scope

One question: what should we see tonight that everyone will actually be happy with.

Two surfaces sharing one data layer. An open listings index, browsable with no account.
A group recommendation flow, one to six people, producing four ranked picks with
showtimes or streaming links attached.

**In:** browse page over a fixed week, group session, Letterboxd ingestion, cold-start
path, vibes input, four ranked picks with generated reasoning, theater and home mode,
mocked split payment.

**Out:** live scraping, real async joining, real CSV parsing, real ticketing, accounts.

## Data model

```
Film        id, tmdb_id, title, year, director, runtime_min, countries, languages,
            genres, keywords, synopsis, poster_url, backdrop_url, lb_slug,
            lb_rating, lb_watch_count, is_repertory

Venue       id, name, kind (indie|chain), chain, neighborhood, borough,
            lat, lng, address, ticket_url

Screening   id, film_id, venue_id, starts_at, format (35mm|70mm|digital|dcp),
            note, is_one_night, ticket_url, price_cents

Streaming   film_id, service, kind (subscription|rent|buy|free), price_cents, deep_link

Profile     id, display_name, source (letterboxd|freeform|chips|mixed), lb_username,
            watched[], watchlist[], liked[], freeform_text, synthesis

Session     id, mode, night, neighborhoods[], services[], venue_filter,
            vibes_text, vibes_chips[], profiles[1..6], results[]
```

Criterion Channel, MUBI and Kanopy are in the service list on purpose. A product that
only knows Netflix picks the same four films as everything else.

## Engine

### Stage 0 — candidate filter (deterministic)

Hard constraints only. Theater mode: has a screening on the chosen night, at a venue in
the chosen neighborhoods, matching the venue type. Home mode: on a service the group has.
Drop anything more than half the group has logged unless it's on someone's watchlist.
Drop over 200 minutes unless the vibes ask for it.

Output: 20–30 candidates. Runs in milliseconds, costs nothing, and is what makes the
model calls affordable.

### Layer 1 — taste synthesis, one call per person

In: up to 50 diary entries with ratings, the watchlist, freeform text, chips.

```json
{
  "summary": "one paragraph in plain language",
  "loves": ["slow character studies", "formally ambitious"],
  "avoids": ["broad studio comedy", "over 150 minutes"],
  "comfort_zone": "...",
  "stretch": "what they'd like but haven't tried",
  "confidence": 0.0
}
```

`confidence` is load-bearing. Someone who typed three words is weighted below someone
with 400 logged films, and the UI shows that rather than pretending all inputs are equal.

### Layer 2 — vibes parsing, one call per session

```json
{
  "tone": ["light", "escapist"],
  "energy": "low | medium | high",
  "hard_filters": { "max_runtime": 120, "exclude_genres": ["horror"] },
  "soft_preferences": ["funny", "nothing that requires concentration"],
  "overrides_taste": true
}
```

When the vibes contradict the group's history, tonight wins and the copy says so.
The implementation detects this by ranking with and without vibes and diffing the top
four, so the override badge is computed rather than asserted.

### Layer 3 — group ranking

Scores each candidate 0–10 per person, then:

**Objective: maximize the minimum.** Rank by each film's lowest individual score,
group mean as tiebreak. This is the mechanical form of "everyone is happy about it."

Each person's score is pulled toward the group mean by `1 - (0.78 + 0.22 × confidence)`,
so a thin profile can't fully veto. The pull is small on purpose — a real 2 still sinks
the film.

Diversity constraint: at most two per decade, at most two per venue. Generate eight,
show four, hold four as alternates so "show me more" returns without a round trip.

### Layer 4 — pick copy, one call for all four

One or two sentences per pick, in terms of the actual people. Sentence one is the case
for it plus the practical detail. Sentence two is what the least-sold person is doing
there. Casual, specific, no marketing voice. This is the text a judge actually reads,
so it deserves real prompt iteration time.

## Taste ingestion

| Path | Gets you | Cost |
| --- | --- | --- |
| RSS `letterboxd.com/{user}/rss/` | ~50 recent diary entries with ratings, TMDB ids | One request |
| Scrape `/watchlist/page/{n}/` | The watchlist — the strongest single signal | ~5 requests, run concurrently |
| Scrape `/films/ratings/page/{n}/` | Full ratings history | ~5 requests |
| Cold start | Freeform text + chip grid | None |

Cache by username. Six users × 10 requests is the difference between a 4-second and a
30-second onboard.

**Why not the API:** it's request-only and the policy explicitly excludes recommendation
projects, data analysis and LLM use. Scraping public pages is the only path. Say so in
the pitch — it reads as a constraint the product works around, not a corner cut.

## Screens

```
/                 Browse — hero, night selector, filters, film rows with showtime strips
/pick/mode        Theater or home
/pick/context     Night, neighborhoods, venue type — or streaming services
/pick/people      1–6 person cards: handle, freeform, chips, CSV
/pick/vibes       Freeform box plus chips
/pick/results     Four ranked cards, objective toggle, agreement bars
/pick/split       Even split, confirm, success
```

Mobile first. The real use case is four people standing on a sidewalk.

## Risks

| Risk | Mitigation |
| --- | --- |
| Letterboxd blocks scraping | Cache the demo profiles before presenting. Live scrape is the stretch, not the dependency. |
| Dataset takes too long | Cut to 8 venues. Density per venue beats venue count. |
| Ranking returns weak picks | Tune against three fixed group scenarios with known right answers. |
| Model latency | Pre-generate the rehearsed scenario, fall back on timeout. |
| Integration goes badly | Freeze the API contract in hour 1 and don't touch it. |

## Rules that held

- Feature freeze at hour 20. Anything broken then is cut and named as future work.
- Deploy at hour 2, not hour 22.
- Mock fixtures committed in hour 1 so frontend never waits on backend.
- Every model call gets a hardcoded fallback. The flow completes even if the API is down.
