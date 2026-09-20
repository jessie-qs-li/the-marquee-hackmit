# The Marquee

A screening index for New York, and a group movie pick everyone is actually happy with.

**[Live demo →](https://jessieqsli.github.io/the-marquee/)**

Built for YHacks 2026, Entertainment track.

---

## The problem

Two of them, and they're the same problem from opposite ends.

Indie cinemas each run their own website. If you want to know what's playing at Film Forum, Metrograph, Anthology, Nitehawk and Quad tonight, that's five tabs, five layouts, five ways of writing "Thursday 7:30, 35mm, introduced by the director." Nobody does this, so people default to whatever's on the chain screen.

And once you've found something, you still have to get three friends to agree on it. Group movie choice reliably collapses into either the loudest person winning or nobody going.

## What this does

**Browse** — everything screening in NYC this week on one page. No account, no onboarding. Filter by night, neighborhood, venue type, and format. Repertory and one-night-only screenings are marked, because scarcity is the thing that actually gets people out of the house.

**Pick** — one to six people import their taste, say what they're in the mood for, and get four ranked films with showtimes attached.

## How the ranking works

The interesting part, and the thing that makes it different from every other recommender.

Most group recommenders average everyone's predicted score. That reliably produces a film three people love and one person sits through. The Marquee ranks by **the lowest score in the group** instead, using the average only to break ties. A film everyone likes fine beats a film that's someone's favorite and someone else's nightmare.

The results screen exposes both objectives as a toggle so you can see the difference. With the three seeded profiles on a Monday night:

| Objective | #1 pick | Lowest individual score |
| --- | --- | --- |
| Everyone's happy | Do the Right Thing | 5.6 |
| Group average | Sinners | 2.5 |

Both are defensible. Only one of them gets everybody out of the house next time.

A thin profile gets pulled slightly toward the group mean, so someone who typed one sentence doesn't get a full veto over someone with 400 logged films. The weight is deliberately small: a genuine 2 still sinks a film.

## Pipeline

A cheap deterministic pass narrows the week down, then judgment happens on the narrowed set.

```
Stage 0   candidate filter      deterministic, no model
          night + neighborhood + venue type + seen-filter + runtime
          ~400 screenings -> ~25 films

Layer 1   taste synthesis       one call per person
          diary + watchlist + freeform -> structured sensibility + confidence

Layer 2   vibes parsing         one call per session
          freeform + chips -> tone, energy, hard filters, override flag

Layer 3   group ranking         one call per session
          per-person scores -> maximize-the-minimum -> top 8

Layer 4   pick copy             one call, all four at once
          why this one, in terms of the actual people
```

In this prototype all four layers run as deterministic tag-matching so the demo works offline and instantly. The interfaces are the same ones the model calls take, so swapping them in is a drop-in.

## Taste input

Four ways in, all producing the same profile shape:

1. **Letterboxd RSS** — `letterboxd.com/{user}/rss/`, roughly the 50 most recent diary entries with ratings.
2. **Profile scraping** — watchlist and full ratings history, since neither is in the feed and the watchlist is the strongest single signal.
3. **Cold start** — a freeform box and a chip grid, for the majority of people who don't use Letterboxd. First class, not a fallback.
4. **CSV upload** — the Letterboxd export zip.

Letterboxd's API is request-only and their [stated policy](https://letterboxd.com/api-beta/) is that they don't grant access for recommendation projects, data analysis, or LLM-related use. RSS plus public page scraping is the only viable path, which is a constraint worth naming rather than hiding.

## Running it

It's one self-contained HTML file with no build step and no dependencies.

```bash
open index.html
```

Or serve it:

```bash
python3 -m http.server 8000
```

## Demo script

1. Land on the browse page. Fourteen tabs, one page.
2. Hit **Find a pick** in the sidebar.
3. Add `@jessieqs`, `@dmarchetti`, `@tobyw` — three genuinely incompatible tastes. Drop a `ratings.csv` on a fourth card if you want to show the export path reading a real file.
4. **Send an invite link**, open it on a phone, and watch the same group rebuild itself with a card waiting for whoever followed it.
5. Vibes: `something dumb and fun, we've all had a long week`
6. The pipeline readout names what each layer did and what it cost. Stage 0 is the number to point at.
7. On the results, toggle **Everyone's happy** against **Group average** and watch the picks reorder.
8. **Split 3 ways** on the top pick, then **send a payment link**. Open it in a second window, pay as one of the others, and watch the amount left to collect fall on the checkout screen without anyone touching it.

## Next

**Live listing normalization** is the real product. Indie theaters run on Squarespace, Agile Ticketing, Veezi and a long tail of custom sites. A scraper per venue doesn't scale past a dozen. The version that scales is a model layer that takes any theater's listings page and returns structured screenings, with per-venue adapters only where extraction fails. That's the piece nobody has built, it compounds with every venue added, and it's why the hardcoded dataset here is a sequencing choice rather than a shortcut.

After that: real async group joining, taste profile persistence and the notification feature it unlocks (*something on three of your watchlists is at Metrograph Friday*), and the data flywheel — every session is labeled preference data about what groups actually choose and what gets vetoed, which is exactly the signal a recommender needs and exactly what nobody collects.

## Repo

```
index.html        the whole prototype, no build step
docs/SPEC.md      full build spec: data model, engine, screens, timeline
```
